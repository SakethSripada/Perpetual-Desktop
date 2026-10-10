import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Pencil, Square, Trash2, GitCompare } from 'lucide-react';
import { useStore } from '../lib/store';
import { action, rpc } from '../lib/api';
import { statusInfo } from '../lib/format';
import type { AgentThread } from '../lib/types';
import { LoaderGrid } from './ai';
import { Confirm, ContextActions, Dot, cn, type Action } from './ui';

const LIVE = ['running', 'running_in_cloud', 'awaiting_approval', 'queued'];

/**
 * The sidebar's tasks: click to open, right-click for actions, double-click
 * or Rename to edit the title in place, and drag to arrange.
 */
export function TaskList({
  selectedId,
  onSelect,
  onReview,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReview: (id: string) => void;
}) {
  const store = useStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [remove, setRemove] = useState<AgentThread | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  // Drag events can outrun re-renders, so the dragged id lives in a ref too.
  const dragged = useRef<string | null>(null);
  const lowerHalf = (e: React.DragEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientY > box.top + box.height / 2;
  };
  const endDrag = () => {
    dragged.current = null;
    setDragging(null);
    setOver(null);
  };
  const drop = (targetId: string, after: boolean) => {
    const source = dragged.current;
    if (!source || source === targetId) return;
    const ids = store.threads.map((t) => t.id).filter((id) => id !== source);
    const at = ids.indexOf(targetId) + (after ? 1 : 0);
    if (at < 0) return;
    ids.splice(at, 0, source);
    void store.reorderThreads(ids);
  };

  const actionsFor = (thread: AgentThread): Action[] => {
    const running = LIVE.includes(thread.status);
    return [
      { label: 'Open', icon: ArrowUpRight, onSelect: () => onSelect(thread.id) },
      { label: 'Rename', icon: Pencil, onSelect: () => setRenaming(thread.id) },
      { label: 'Review changes', icon: GitCompare, onSelect: () => onReview(thread.id) },
      ...(running
        ? [
            {
              label: 'Stop',
              icon: Square,
              onSelect: () =>
                void action(async () => {
                  await rpc('stop_agent_thread', { thread_id: thread.id });
                  await store.refresh();
                }),
            },
          ]
        : []),
      {
        label: 'Delete',
        icon: Trash2,
        danger: true,
        separated: true,
        onSelect: () => setRemove(thread),
      },
    ];
  };

  if (!store.threads.length)
    return store.loading ? null : <p className="px-3 py-1.5 text-xs text-faint">No tasks yet</p>;

  return (
    <>
      {store.threads.map((t) => {
        const status = statusInfo(t.status);
        const flagged = status.live || status.tone === 'warning' || status.tone === 'danger';
        const active = selectedId === t.id;
        const marker = over?.id === t.id && dragging && dragging !== t.id;
        return (
          <ContextActions key={t.id} actions={actionsFor(t)}>
            <div
              role="button"
              tabIndex={0}
              draggable={renaming !== t.id}
              title={t.title}
              onClick={() => renaming !== t.id && onSelect(t.id)}
              onDoubleClick={() => setRenaming(t.id)}
              onKeyDown={(e) => {
                if (renaming === t.id) return;
                if (e.key === 'Enter') onSelect(t.id);
                if (e.key === 'F2') setRenaming(t.id);
                if (e.key === 'Delete') setRemove(t);
              }}
              onDragStart={(e) => {
                dragged.current = t.id;
                setDragging(t.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', t.title);
              }}
              onDragOver={(e) => {
                if (!dragged.current) return;
                e.preventDefault();
                const after = lowerHalf(e);
                setOver((v) => (v?.id === t.id && v.after === after ? v : { id: t.id, after }));
              }}
              onDragLeave={() => setOver((v) => (v?.id === t.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                drop(t.id, lowerHalf(e));
                endDrag();
              }}
              onDragEnd={endDrag}
              className={cn(
                'relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-hover',
                active ? 'bg-hover text-ink' : 'text-muted hover:bg-hover hover:text-ink',
                dragging === t.id && 'opacity-40',
              )}
            >
              {marker && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-2 left-2 h-0.5 rounded-full bg-accent',
                    over.after ? '-bottom-px' : '-top-px',
                  )}
                />
              )}
              {renaming === t.id ? (
                <RenameField
                  thread={t}
                  onDone={async (title) => {
                    setRenaming(null);
                    if (title && title !== t.title)
                      await action(async () => {
                        await rpc('update_agent_thread', { id: t.id, patch: { title } });
                        await store.refresh();
                      });
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  {t.title.length > 64
                    ? t.title.slice(0, 63).trimEnd() + '…'
                    : t.title || 'Untitled task'}
                </span>
              )}
              {status.tone === 'accent' && status.live ? (
                <LoaderGrid size={3} />
              ) : (
                flagged && <Dot tone={status.tone} live={status.live} />
              )}
            </div>
          </ContextActions>
        );
      })}
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Delete this task?"
        description={
          <>
            <span className="text-ink">{remove?.title || 'Untitled task'}</span>
            {remove && LIVE.includes(remove.status)
              ? ' is still running. Deleting it stops the task and removes its conversation.'
              : ' and its conversation will be deleted. Changes you applied to projects stay.'}
          </>
        }
        confirmLabel={remove && LIVE.includes(remove.status) ? 'Stop and delete' : 'Delete'}
        danger
        onConfirm={() =>
          action(async () => {
            const target = remove!;
            await rpc('delete_agent_thread', {
              id: target.id,
              force: LIVE.includes(target.status),
            });
            if (selectedId === target.id) onSelect(null);
            await store.refresh();
          })
        }
      />
    </>
  );
}

function RenameField({
  thread,
  onDone,
}: {
  thread: AgentThread;
  onDone: (title: string | null) => void;
}) {
  const [title, setTitle] = useState(thread.title);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value?.trim() || null);
  };
  useEffect(() => {
    // Wait a frame so a closing menu doesn't take focus back.
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <input
      ref={input}
      aria-label="Task name"
      value={title}
      maxLength={120}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => finish(title)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(title);
        if (e.key === 'Escape') finish(null);
      }}
      className="!h-6 min-w-0 flex-1 !rounded-md !px-1.5 !text-[13px]"
    />
  );
}
