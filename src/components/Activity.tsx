import { useEffect, useState } from 'react';
import { Clock3, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { useStore } from '../lib/store';
import { action, native, rpc } from '../lib/api';
import type { ActivityEvent } from '../lib/types';
import { Button, Empty, PageHeading } from './ui';
export function Activity() {
  const store = useStore();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const load = () =>
    action(async () => {
      if (native)
        setEvents(await rpc<ActivityEvent[]>('list_activity', { project_id: null, limit: 200 }));
    });
  useEffect(() => {
    void load();
  }, [store.revision]);
  return (
    <>
      <PageHeading
        title="Activity"
        description="A clear record of progress, account switches, and handoffs."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />
      {events.length ? (
        <div className="divide-y divide-line">
          {events.map((event) => (
            <details key={event.id} className="py-4">
              <summary className="flex cursor-pointer items-center gap-3 text-sm">
                <ArrowRightLeft size={15} className="text-muted" />
                <span>{event.kind.replaceAll('.', ' · ').replaceAll('_', ' ')}</span>
                <time className="ml-auto text-xs text-muted">
                  {new Date(event.ts).toLocaleString()}
                </time>
              </summary>
              <pre className="mt-3 overflow-auto rounded-lg bg-sidebar p-3 text-xs leading-6 text-muted">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      ) : (
        <Empty icon={<Clock3 size={26} />} title="A fresh start">
          As you work, Perpetual records what happened and why. Account switches and rate-limit
          resets appear here.
        </Empty>
      )}
    </>
  );
}
