ALTER TABLE work_nodes ADD COLUMN workflow_model TEXT;
ALTER TABLE work_nodes ADD COLUMN workflow_reasoning TEXT;
ALTER TABLE work_nodes ADD COLUMN workflow_permission TEXT NOT NULL DEFAULT 'workspace_write';
ALTER TABLE work_nodes ADD COLUMN workflow_limit_behavior TEXT NOT NULL DEFAULT 'inherit';

UPDATE work_nodes SET
  workflow_model = (SELECT model FROM agent_threads WHERE id = work_nodes.thread_id),
  workflow_reasoning = (SELECT reasoning FROM agent_threads WHERE id = work_nodes.thread_id),
  workflow_permission = COALESCE((SELECT permission FROM agent_threads WHERE id = work_nodes.thread_id), 'workspace_write')
WHERE thread_id IS NOT NULL;

UPDATE work_nodes SET workflow_model = (SELECT model FROM tasks WHERE id = work_nodes.task_id)
WHERE task_id IS NOT NULL;

ALTER TABLE work_plan_runs ADD COLUMN root_node_id TEXT;
