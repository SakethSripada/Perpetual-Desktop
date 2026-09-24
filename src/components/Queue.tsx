import { useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import type { QueuedTurn } from '../lib/types';
import { action, rpc } from '../lib/api';
import { Button, Modal } from './ui';
export function Queue({ turns, refresh }: { turns: QueuedTurn[]; refresh: () => Promise<void> }) {
  const [edit, setEdit] = useState<QueuedTurn | null>(null);
  const [message, setMessage] = useState('');
  const move = (index: number, direction: number) =>
    action(async () => {
      const ids = turns.map((turn) => turn.id);
      const next = index + direction;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      await rpc('reorder_queued_turns', { thread_id: turns[index].thread_id, ordered_ids: ids });
      await refresh();
    });
  if (!turns.length) return null;
  return (
    <>
      <div className="mb-3 rounded-xl border border-line p-3">
        <div className="mb-2 text-xs text-muted">Queued follow-ups</div>
        {turns.map((turn, index) => (
          <div key={turn.id} className="flex items-center gap-1 text-xs">
            <span className="min-w-0 flex-1 truncate">{turn.message}</span>
            <Button
              aria-label="Move message earlier"
              disabled={!index}
              onClick={() => void move(index, -1)}
              className="px-1.5"
            >
              <ArrowUp size={12} />
            </Button>
            <Button
              aria-label="Move message later"
              disabled={index === turns.length - 1}
              onClick={() => void move(index, 1)}
              className="px-1.5"
            >
              <ArrowDown size={12} />
            </Button>
            <Button
              aria-label="Edit queued message"
              className="px-1.5"
              onClick={() => {
                setEdit(turn);
                setMessage(turn.message);
              }}
            >
              <Pencil size={12} />
            </Button>
            <Button
              aria-label="Remove queued message"
              className="px-1.5"
              onClick={() =>
                void action(async () => {
                  await rpc('delete_queued_turn', { id: turn.id });
                  await refresh();
                })
              }
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onOpenChange={(v) => !v && setEdit(null)} title="Edit queued message">
        <textarea
          className="field w-full"
          aria-label="Queued message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button
          variant="solid"
          className="mt-4"
          disabled={!message.trim()}
          onClick={() =>
            void action(async () => {
              await rpc('update_queued_turn', { id: edit?.id, message });
              await refresh();
              setEdit(null);
            })
          }
        >
          Save message
        </Button>
      </Modal>
    </>
  );
}
