use am_core::AppCore;
use am_daemon::{
    dispatch,
    protocol::{DaemonRequest as Request, DaemonResponse as Response},
};
use am_proto::{AgentKind, NewAgentThread, ProviderAccount, ProviderAccountAuthMode};

#[tokio::test]
async fn desktop_policy_and_session_survive_restart() {
    let root = std::env::temp_dir().join(format!("perpetual-desktop-test-{}", std::process::id()));
    let core = AppCore::new(&root).await.unwrap();
    let Response::LimitPolicy(mut policy) = dispatch(&core, Request::GetLimitPolicy).await.unwrap()
    else {
        panic!("policy response")
    };
    policy.auto_switch = true;
    policy.switch_back = true;
    policy.accounts = vec![
        ProviderAccount {
            id: "desktop-test-codex".into(),
            label: "Codex test".into(),
            agent: AgentKind::Codex,
            enabled: false,
            use_credits: false,
            auth_mode: ProviderAccountAuthMode::IsolatedCli,
        },
        ProviderAccount {
            id: "desktop-test-claude".into(),
            label: "Claude test".into(),
            agent: AgentKind::ClaudeCode,
            enabled: false,
            use_credits: false,
            auth_mode: ProviderAccountAuthMode::IsolatedCli,
        },
    ];
    dispatch(&core, Request::SetLimitPolicy(policy))
        .await
        .unwrap();
    let Response::AgentThread(thread) = dispatch(
        &core,
        Request::CreateAgentThread(NewAgentThread {
            title: "Desktop persistence test".into(),
            ..Default::default()
        }),
    )
    .await
    .unwrap() else {
        panic!("thread response")
    };
    core.shutdown().await;
    core.db.pool.close().await;
    drop(core);
    let restored = AppCore::new(&root).await.unwrap();
    let Response::LimitPolicy(policy) = dispatch(&restored, Request::GetLimitPolicy).await.unwrap()
    else {
        panic!("policy response")
    };
    assert_eq!(policy.accounts[0].agent, AgentKind::Codex);
    assert_eq!(policy.accounts[1].agent, AgentKind::ClaudeCode);
    assert!(policy.auto_switch && policy.switch_back);
    assert!(policy.accounts.iter().all(|account| !account.use_credits));
    let Response::AgentThreadOpt(Some(saved)) =
        dispatch(&restored, Request::GetAgentThread { id: thread.id })
            .await
            .unwrap()
    else {
        panic!("persisted thread")
    };
    assert_eq!(saved.title, "Desktop persistence test");
    restored.shutdown().await;
    restored.db.pool.close().await;
    drop(restored);
    std::fs::remove_dir_all(root).unwrap();
}
