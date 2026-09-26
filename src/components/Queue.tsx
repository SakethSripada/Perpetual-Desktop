import { useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, Pencil, X } from 'lucide-react';
import type { QueuedTurn } from '../lib/types';
import { action, rpc } from '../lib/api';
import { Button, Modal, Tip } from './ui';

/** Follow-ups waiting for the current step to finish, in the order they'll run. */
export function Queue({ turns, refresh }: { turns: QueuedTurn[]; refresh: () => Promise<void> }) {
  const [edit, setEdit] = useState<QueuedTurn | null>(null);
  const [message, setMessage] = useState('');
  const visible = turns.filter((turn) => turn.echo_user_message !== false);
  const move = (index: number, direction: number) =>
    action(async () => {
      const ids = turns.map((turn) => turn.id);
      const next = index + direction;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      await rpc('reorder_queued_turns', { thread_id: turns[index].thread_id, ordered_ids: ids });
      await refresh();
    });
  const save = () =>
    void action(async () => {
      await rpc('update_queued_turn', { id: edit?.id, message: message.trim() });
      await refresh();
      setEdit(null);
    });
  if (!visible.length) return null;
  return (
    <>
      <div className="mb-2 rounded-xl border border-line bg-elevated/50 px-3 py-2">
        <div className="mb-1 text-[11px] font-medium text-faint">
          Up next · {visible.length} {visible.length === 1 ? 'message' : 'messages'}
        </div>
        {visible.map((turn) => {
          const index = turns.indexOf(turn);
          return (
            <div key={turn.id} className="group flex h-7 items-center gap-1 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-muted">{turn.message}</span>
              <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <QueueAction label="Move up" disabled={!index} onClick={() => void move(index, -1)}>
                  <ArrowUp size={13} />
                </QueueAction>
                <QueueAction
                  label="Move down"
                  disabled={index === turns.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown size={13} />
                </QueueAction>
                <QueueAction
                  label="Edit"
                  onClick={() => {
                    setEdit(turn);
                    setMessage(turn.message);
                  }}
                >
                  <Pencil size={13} />
                </QueueAction>
                <QueueAction
                  label="Remove"
                  onClick={() =>
                    void action(async () => {
                      await rpc('delete_queued_turn', { id: turn.id });
                      await refresh();
                    })
                  }
                >
                  <X size={14} />
                </QueueAction>
              </div>
            </div>
          );
        })}
      </div>
      <Modal
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        title="Edit message"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!message.trim()} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <textarea
          autoFocus
          className="field w-full resize-none"
          aria-label="Message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Modal>
    </>
  );
}

function QueueAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <button
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
      >
        {children}
      </button>
    </Tip>
  );
}
