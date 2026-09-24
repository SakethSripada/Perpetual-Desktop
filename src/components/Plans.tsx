import { useEffect, useState } from 'react';
import { GitBranch, Plus, Play, Square, Trash2, ArrowRight } from 'lucide-react';
import { useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import type { WorkGraph } from '../lib/types';
import { Button, Empty, Modal, PageHeading, Select } from './ui';
export function Plans({ onSelect }: { onSelect: (id: string) => void }) {
  const store = useStore();
  const [graph, setGraph] = useState<WorkGraph | null>(null);
  const [add, setAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agent, setAgent] = useState('codex');
  const [parent, setParent] = useState('');
  const load = () =>
    action(async () => {
      if (store.project && native)
        setGraph(await rpc<WorkGraph>('get_work_graph', { project_id: store.project.id }));
    });
  useEffect(() => {
    void load();
  }, [store.project?.id, store.revision]);
  return (
    <>
      <PageHeading
        title="Plans"
        description="Break longer work into tasks that keep their context."
        actions={
          <Button variant="solid" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Add task
          </Button>
        }
      />
      {graph?.nodes.length ? (
        <div className="space-y-3">
          {graph.nodes.map((node) => (
            <div key={node.id} className="rounded-xl border border-line p-5">
              <div className="flex items-center gap-3">
                <GitBranch size={18} className="text-muted" />
                <div className="flex-1">
                  <h2 className="text-sm font-medium">{node.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {node.status.replaceAll('_', ' ')}
                    {node.parent_id &&
                      ` · ${graph.nodes.find((n) => n.id === node.parent_id)?.title}`}
                  </p>
                </div>
                {node.thread_id && (
                  <Button onClick={() => onSelect(node.thread_id!)}>
                    Open task
                    <ArrowRight size={13} />
                  </Button>
                )}
                <Button
                  aria-label="Run plan task"
                  onClick={() =>
                    void action(async () => {
                      await rpc('run_work_node', {
                        node_id: node.id,
                        agent: node.primary_agent || 'codex',
                        permission: 'workspace_write',
                        execution_backend: 'host',
                      });
                      await load();
                    })
                  }
                >
                  <Play size={14} />
                </Button>
                <Button
                  aria-label="Stop plan task"
                  onClick={() =>
                    void action(async () => {
                      await rpc('stop_work_node', { node_id: node.id });
                      await load();
                    })
                  }
                >
                  <Square size={13} />
                </Button>
              </div>
              {node.description && (
                <p className="mt-3 text-sm leading-6 text-muted">{node.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<GitBranch size={26} />} title="Make room for bigger work">
          Organize tasks into a plan. Each task gets persistent context and its own execution
          history.
          <div className="mt-5">
            <Button variant="outline" onClick={() => setAdd(true)}>
              <Plus size={14} />
              Create a task
            </Button>
          </div>
        </Empty>
      )}
      <Modal
        open={add}
        onOpenChange={setAdd}
        title="Add a plan task"
        description="Give the agent a clear objective and attach it to a parent task if needed."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await rpc('create_work_node', {
                project_id: store.project?.id,
                title,
                description,
                primary_agent: agent,
                parent_id: parent || null,
                kind: 'task',
              });
              await load();
              setAdd(false);
              setTitle('');
              setDescription('');
            });
          }}
        >
          <input
            required
            aria-label="Task title"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="field"
            aria-label="Objective"
            rows={4}
            placeholder="What should this task accomplish?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Select aria-label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="codex">Codex</option>
            <option value="claude_code">Claude Code</option>
          </Select>
          <Select
            aria-label="Parent task"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value="">No parent task</option>
            {graph?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </Select>
          <Button variant="solid" type="submit">
            Create task
          </Button>
        </form>
      </Modal>
    </>
  );
}
