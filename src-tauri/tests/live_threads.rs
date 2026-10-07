//! Opt-in smoke checks for the desktop's actual thread RPCs, using isolated
//! app data and the existing provider login. No real project files are used.
//! cargo test -p perpetual-desktop --test live_threads -- --ignored --nocapture
use am_core::AppCore;
use am_daemon::{
    dispatch,
    protocol::{DaemonRequest as Q, DaemonResponse as R},
};
use am_proto::{AgentKind, NewAgentThread, TaskStatus};
use std::time::Duration;

async fn smoke(agent: AgentKind) {
    let root = std::env::temp_dir().join(format!("perpetual-live-thread-{}", am_proto::new_id()));
    let core = AppCore::new(&root).await.unwrap();
    let accounts = core.provider_account_statuses().await.unwrap();
    assert!(
        accounts
            .iter()
            .any(|s| s.account.agent == agent && s.installed && s.authenticated),
        "{} must be installed and signed in for this opt-in smoke test",
        agent.label()
    );
    let project = core.ensure_workbench_project().await.unwrap();
    let R::AgentThread(thread) = dispatch(
        &core,
        Q::CreateAgentThread(NewAgentThread {
            title: "Launch readiness smoke test".into(),
            project_id: Some(project.id),
            preferred_agent: Some(agent),
            force_managed_workspace: true,
            ..Default::default()
        }),
    )
    .await
    .unwrap() else {
        panic!("create response");
    };
    for (index, message) in [
        "Reply with exactly PERPETUAL_SMOKE_FIRST. Do not use tools or change any files.",
        "Reply with exactly PERPETUAL_SMOKE_SECOND. Do not use tools or change any files.",
    ]
    .iter()
    .enumerate()
    {
        let client_id = format!("smoke-{index}");
        dispatch(
            &core,
            Q::SendThreadMessage {
                thread_id: thread.id.clone(),
                agent,
                permission: serde_json::from_str("\"read_only\"").unwrap(),
                message: (*message).into(),
                client_message_id: Some(client_id),
            },
        )
        .await
        .unwrap();
        tokio::time::timeout(Duration::from_secs(120), async {
            loop {
                let saved = core.get_agent_thread(&thread.id).await.unwrap().unwrap();
                if matches!(
                    saved.status,
                    TaskStatus::Done
                        | TaskStatus::Review
                        | TaskStatus::Failed
                        | TaskStatus::WaitingForLimit
                        | TaskStatus::Paused
                ) {
                    assert!(
                        matches!(saved.status, TaskStatus::Done | TaskStatus::Review),
                        "{} ended in {:?}",
                        agent.label(),
                        saved.status
                    );
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        })
        .await
        .expect("thread must finish within two minutes");
        let events = core.list_thread_events(&thread.id).await.unwrap();
        let marker = if index == 0 {
            "PERPETUAL_SMOKE_FIRST"
        } else {
            "PERPETUAL_SMOKE_SECOND"
        };
        assert!(
            events.iter().any(|e| e.role == "assistant"
                && e.text.as_deref().is_some_and(|text| text.contains(marker))),
            "{} response missing",
            agent.label()
        );
        assert_eq!(
            events.iter().filter(|e| e.role == "user").count(),
            index + 1
        );
    }
    core.shutdown().await;
    core.db.pool.close().await;
    drop(core);
    let restored = AppCore::new(&root).await.unwrap();
    assert_eq!(
        restored.list_thread_turns(&thread.id).await.unwrap().len(),
        2
    );
    assert!(restored
        .list_thread_events(&thread.id)
        .await
        .unwrap()
        .iter()
        .any(|e| e
            .text
            .as_deref()
            .is_some_and(|text| text.contains("PERPETUAL_SMOKE_SECOND"))));
    restored.shutdown().await;
    restored.db.pool.close().await;
    drop(restored);
    std::fs::remove_dir_all(root).unwrap();
}

#[tokio::test]
#[ignore = "requires signed-in Codex and a network connection"]
async fn codex_thread_reply_resume_and_restart() {
    smoke(AgentKind::Codex).await;
}

#[tokio::test]
#[ignore = "requires signed-in Claude and a network connection"]
async fn claude_thread_reply_resume_and_restart() {
    smoke(AgentKind::ClaudeCode).await;
}
