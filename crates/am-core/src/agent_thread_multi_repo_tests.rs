use super::*;
use std::time::Duration;

struct Fixture {
    root: PathBuf,
    core: AppCore,
    thread: AgentThread,
    links: Vec<am_proto::AgentThreadRepo>,
    workspace: PathBuf,
}

impl Fixture {
    async fn new() -> Self {
        let root = std::env::temp_dir().join(format!("perpetual multi repo {}", new_id()));
        let mut core = crate::test_core().await;
        core.data_dir = root.join("app data");
        let project = core
            .create_project(am_proto::NewProject {
                name: "Multi folder test".into(),
                description: None,
            })
            .await
            .unwrap();
        let mut repo_ids = Vec::new();
        for side in ["left", "right"] {
            // Same folder and file names exercise repository identity separately
            // from display names; spaces exercise subprocess path handling.
            let repo = root.join(side).join("same name");
            std::fs::create_dir_all(&repo).unwrap();
            std::fs::write(repo.join("shared.txt"), "original\n").unwrap();
            std::fs::write(repo.join("deleted.txt"), "delete me\n").unwrap();
            let connected = core
                .connect_local_repo(am_proto::NewLocalRepo {
                    project_id: project.id.clone(),
                    path: repo.to_string_lossy().into_owned(),
                    initialize: true,
                })
                .await
                .unwrap();
            let configured = Command::new("git")
                .arg("-C")
                .arg(&repo)
                .args(["config", "core.autocrlf", "false"])
                .status()
                .unwrap();
            assert!(configured.success());
            repo_ids.push(connected.id);
        }
        let thread = core
            .create_agent_thread(NewAgentThread {
                project_id: Some(project.id),
                title: "Multi folder test".into(),
                repo_ids,
                ..Default::default()
            })
            .await
            .unwrap();
        let workspace = core
            .ensure_thread_workspace(
                &thread,
                ExecutionBackend::Host,
                PermissionPolicy::WorkspaceWrite,
            )
            .await
            .unwrap();
        assert!(!workspace.uses_visible_repo);
        core.render_thread_context_files(&thread, &workspace.path)
            .await
            .unwrap();
        let links = core.list_thread_repos(&thread.id).await.unwrap();
        assert_eq!(links.len(), 2);
        assert_ne!(links[0].worktree_path, links[1].worktree_path);
        for link in &links {
            assert_eq!(
                Path::new(link.worktree_path.as_ref().unwrap()).parent(),
                Some(workspace.path.as_path())
            );
        }
        Self {
            root,
            core,
            thread,
            links,
            workspace: workspace.path,
        }
    }

    fn worktree(&self, index: usize) -> PathBuf {
        PathBuf::from(self.links[index].worktree_path.as_ref().unwrap())
    }

    async fn original(&self, index: usize) -> PathBuf {
        let repo = am_db::repos::repo::get(&self.core.db.pool, &self.links[index].repo_id)
            .await
            .unwrap()
            .unwrap();
        PathBuf::from(repo.local_path.unwrap())
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        // Only this newly-created, uniquely-named fixture is removed.
        assert_eq!(self.root.parent(), Some(std::env::temp_dir().as_path()));
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[tokio::test]
async fn multi_repo_diffs_apply_and_followups_preserve_repository_identity() {
    let fixture = Fixture::new().await;
    for index in 0..2 {
        let worktree = fixture.worktree(index);
        std::fs::write(worktree.join("shared.txt"), format!("edited {index}\n")).unwrap();
        std::fs::write(worktree.join("new.txt"), format!("new {index}\n")).unwrap();
        std::fs::remove_file(worktree.join("deleted.txt")).unwrap();
    }
    // Agents may commit one repository and leave another uncommitted. Both
    // kinds of changes must remain visible and clear after applying.
    am_vcs::checkpoint_worktree_with_excludes(
        &fixture.worktree(0),
        "Agent committed changes",
        GENERATED_CONTEXT_FILES,
    )
    .unwrap()
    .expect("agent commit");
    for _ in 0..2 {
        let diff = fixture.core.thread_diff(&fixture.thread.id).await.unwrap();
        assert_eq!(diff.repos.len(), 2);
        for (index, link) in fixture.links.iter().enumerate() {
            let repo = diff
                .repos
                .iter()
                .find(|repo| repo.repo_id == link.repo_id)
                .unwrap();
            assert_eq!(repo.files.len(), 3, "context files must be excluded");
            for path in ["shared.txt", "new.txt", "deleted.txt"] {
                assert!(repo.files.iter().any(|file| file.path == path));
            }
            assert!(repo.patch.contains(&format!("edited {index}")));
            assert!(repo.patch.contains(&format!("new {index}")));
            assert!(!repo.patch.contains(&format!("edited {}", 1 - index)));
            let original = fixture.original(index).await;
            assert_eq!(
                std::fs::read_to_string(original.join("shared.txt")).unwrap(),
                "original\n"
            );
            assert!(!original.join("new.txt").exists());
        }
    }
    let before = fixture
        .core
        .list_thread_repos(&fixture.thread.id)
        .await
        .unwrap();
    let resumed = fixture
        .core
        .ensure_thread_workspace(
            &fixture.thread,
            ExecutionBackend::Host,
            PermissionPolicy::WorkspaceWrite,
        )
        .await
        .unwrap();
    assert_eq!(resumed.path, fixture.workspace);
    let after = fixture
        .core
        .list_thread_repos(&fixture.thread.id)
        .await
        .unwrap();
    for link in &before {
        let same = after
            .iter()
            .find(|next| next.repo_id == link.repo_id)
            .unwrap();
        assert_eq!(same.worktree_path, link.worktree_path);
        assert_eq!(same.base_ref, link.base_ref);
    }
    let applied = fixture
        .core
        .apply_thread_changes(&fixture.thread.id)
        .await
        .unwrap();
    assert!(applied.applied, "{applied:?}");
    assert_eq!(applied.repos.iter().filter(|repo| repo.applied).count(), 2);
    for index in 0..2 {
        let original = fixture.original(index).await;
        assert_eq!(
            std::fs::read_to_string(original.join("shared.txt")).unwrap(),
            format!("edited {index}\n")
        );
        assert_eq!(
            std::fs::read_to_string(original.join("new.txt")).unwrap(),
            format!("new {index}\n")
        );
        assert!(!original.join("deleted.txt").exists());
        assert!(!original.join("TASK_CONTEXT.md").exists());
    }
    assert!(fixture
        .core
        .thread_diff(&fixture.thread.id)
        .await
        .unwrap()
        .repos
        .iter()
        .all(|repo| repo.files.is_empty()));
    std::fs::write(fixture.worktree(1).join("shared.txt"), "followup\n").unwrap();
    let diff = fixture.core.thread_diff(&fixture.thread.id).await.unwrap();
    assert_eq!(
        diff.repos
            .iter()
            .filter(|repo| !repo.files.is_empty())
            .count(),
        1
    );
    let changed = diff
        .repos
        .iter()
        .find(|repo| !repo.files.is_empty())
        .unwrap();
    assert_eq!(changed.repo_id, fixture.links[1].repo_id);
    assert!(changed.patch.contains("followup"));
}

#[tokio::test]
async fn multi_repo_apply_preflights_every_folder_before_writing_any() {
    let fixture = Fixture::new().await;
    for index in 0..2 {
        std::fs::write(fixture.worktree(index).join("shared.txt"), "agent edit\n").unwrap();
    }
    std::fs::write(fixture.original(1).await.join("shared.txt"), "user edit\n").unwrap();
    let applied = fixture
        .core
        .apply_thread_changes(&fixture.thread.id)
        .await
        .unwrap();
    assert!(!applied.applied);
    assert!(!applied.blockers.is_empty());
    assert!(applied.repos.iter().all(|repo| !repo.applied));
    assert_eq!(
        std::fs::read_to_string(fixture.original(0).await.join("shared.txt")).unwrap(),
        "original\n"
    );
    assert_eq!(
        std::fs::read_to_string(fixture.original(1).await.join("shared.txt")).unwrap(),
        "user edit\n"
    );
    assert!(fixture
        .core
        .thread_diff(&fixture.thread.id)
        .await
        .unwrap()
        .repos
        .iter()
        .all(|repo| !repo.files.is_empty()));
}

#[tokio::test]
#[ignore = "requires installed, signed-in Codex and Claude; uses subscription tokens"]
async fn multi_repo_live_agents_edit_both_folders_and_surface_diffs() {
    use am_agents::{
        AgentAdapter, ApprovalDecision, ApprovalResponder, ClaudeAdapter, CodexAdapter,
    };
    for agent in [AgentKind::Codex, AgentKind::ClaudeCode] {
        let fixture = Fixture::new().await;
        let prompt = format!(
            "Runtime smoke test only. Edit shared.txt in BOTH folders listed below to contain exactly `agent-edited` followed by a newline, and create new.txt in BOTH with exactly `agent-created` followed by a newline. Use file edit tools. Do not commit, delete files, or run other tasks. Folders: {} and {}. Reply briefly when complete.",
            fixture.worktree(0).display(), fixture.worktree(1).display(),
        );
        let mut policy = am_agents::AgentPolicyRuntime::default();
        add_managed_git_safe_directories(
            &mut policy.launch_env,
            &[fixture.worktree(0), fixture.worktree(1)],
        )
        .unwrap();
        let spec = SessionSpec {
            worktree: fixture.workspace.clone(),
            prompt,
            model: None,
            reasoning: None,
            local_model: None,
            permission: PermissionPolicy::WorkspaceWrite,
            runtime: am_agents::SessionRuntime::default(),
            policy: Some(policy),
            approver: Some(ApprovalResponder::new(|ask| {
                Box::pin(async move {
                    if matches!(
                        ask.tool_name.as_str(),
                        "Read" | "Write" | "Edit" | "apply_patch"
                    ) {
                        ApprovalDecision::Allow
                    } else {
                        ApprovalDecision::Deny
                    }
                })
            })),
        };
        let adapter: Box<dyn AgentAdapter> = match agent {
            AgentKind::Codex => Box::new(CodexAdapter::new()),
            _ => Box::new(ClaudeAdapter::new()),
        };
        println!("Starting {agent:?} multi-folder edit smoke");
        let mut handle = adapter.start(spec).await.unwrap();
        let outcome = tokio::time::timeout(Duration::from_secs(180), async {
            while let Some(event) = handle.events.recv().await {
                match event {
                    NormalizedEvent::Error { message, .. } => panic!("{agent:?}: {message}"),
                    NormalizedEvent::SessionEnded { status } => {
                        assert_eq!(status, SessionStatus::Completed);
                        return;
                    }
                    NormalizedEvent::ToolUse { name, .. } => println!("{agent:?} tool: {name}"),
                    _ => {}
                }
            }
            panic!("{agent:?} closed without completion");
        })
        .await;
        handle.control.cancel();
        outcome.expect("agent timed out");
        for index in 0..2 {
            assert_eq!(
                std::fs::read_to_string(fixture.worktree(index).join("shared.txt")).unwrap(),
                "agent-edited\n"
            );
            assert_eq!(
                std::fs::read_to_string(fixture.worktree(index).join("new.txt")).unwrap(),
                "agent-created\n"
            );
            assert_eq!(
                std::fs::read_to_string(fixture.original(index).await.join("shared.txt")).unwrap(),
                "original\n"
            );
        }
        let diff = fixture.core.thread_diff(&fixture.thread.id).await.unwrap();
        assert_eq!(diff.repos.len(), 2);
        for repo in diff.repos {
            assert_eq!(repo.files.len(), 2);
            assert!(repo.patch.contains("agent-edited"));
            assert!(repo.patch.contains("agent-created"));
        }
        println!("Passed {agent:?}: both folders edited, diffs grouped, originals untouched");
    }
}
