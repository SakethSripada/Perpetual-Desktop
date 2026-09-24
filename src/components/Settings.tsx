import { useEffect, useState } from 'react';
import { Monitor, Cloud, Box, Laptop, Keyboard, RefreshCw, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { action, native, rpc } from '../lib/api';
import { Button, PageHeading, Select, Toggle, cn } from './ui';
const pages = [
  { id: 'general', label: 'General', icon: Monitor },
  { id: 'cloud', label: 'Cloud continuity', icon: Cloud },
  { id: 'sandbox', label: 'Docker Sandbox', icon: Box },
  { id: 'local_model', label: 'Local models', icon: Laptop },
];
type Policy = Record<string, unknown>;
const labels: Record<string, [string, string?]> = {
  enabled: ['Enable cloud continuity', 'Continue eligible tasks in the provider cloud.'],
  continue_on_sleep: ['Continue when this computer sleeps'],
  continue_on_shutdown: ['Continue on shutdown'],
  allow_cross_provider: ['Allow switching cloud providers'],
  require_approval: ['Ask before handing off to the cloud'],
  codex_env_id: ['Codex cloud environment ID'],
  checkpoint_interval_secs: ['Checkpoint interval (seconds)'],
  monitor_poll_secs: ['Cloud check interval (seconds)'],
  stall_timeout_secs: ['Stall timeout (seconds)'],
  max_concurrent_cloud_runs: ['Concurrent cloud tasks'],
  default_backend: ['Default execution environment'],
  max_concurrent_sandboxes: ['Concurrent sandboxes'],
  cpus: ['CPUs per sandbox'],
  memory: ['Memory per sandbox'],
  network_preset: ['Network policy'],
  run_timeout_secs: ['Run timeout (seconds)'],
  idle_timeout_secs: ['Idle timeout (seconds)'],
  stop_grace_secs: ['Stop grace period (seconds)'],
  auto_resume_cloud: ['Resume cloud models after reconnecting'],
  use_local_fallback: ['Use local models when offline'],
  switch_back_to_cloud: ['Return to cloud models when available'],
  probe_interval_secs: ['Connection check interval (seconds)'],
  offline_grace_secs: ['Offline grace period (seconds)'],
  stable_successes: ['Successful checks before reconnecting'],
  ollama_base_url: ['Ollama server URL'],
  lm_studio_base_url: ['LM Studio server URL'],
};
export function Settings({ theme, setTheme }: { theme: string; setTheme: (v: string) => void }) {
  const [page, setPage] = useState('general');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<unknown>(null);
  useEffect(() => {
    setPolicy(null);
    setDirty(false);
    setStatus(null);
    if (page !== 'general' && native)
      void action(async () => setPolicy(await rpc<Policy>(`get_${page}_policy`)));
  }, [page]);
  const change = (key: string, value: unknown) => {
    setPolicy((old) => ({ ...old, [key]: value }));
    setDirty(true);
  };
  const save = () =>
    action(async () => {
      setSaving(true);
      try {
        setPolicy(await rpc<Policy>(`set_${page}_policy`, policy));
        setDirty(false);
      } finally {
        setSaving(false);
      }
    }, 'Settings saved');
  return (
    <>
      <PageHeading title="Settings" description="Make Perpetual work the way you do." />
      <div className="flex gap-10">
        <nav className="w-44 shrink-0 space-y-1">
          {pages.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (!dirty || window.confirm('Discard unsaved settings?')) setPage(item.id);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px]',
                page === item.id ? 'bg-hover text-ink' : 'text-muted hover:bg-hover',
              )}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {page === 'general' ? (
            <>
              <h2 className="mb-5 text-base font-medium">Appearance</h2>
              <div className="grid grid-cols-2 gap-4">
                {['dark', 'light'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      'overflow-hidden rounded-xl border p-2 text-left',
                      t === theme ? 'border-accent' : 'border-line',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-2 flex h-24 overflow-hidden rounded-lg',
                        t === 'dark' ? 'bg-[#242424]' : 'bg-[#faf9f6]',
                      )}
                    >
                      <div
                        className={cn('w-1/4 p-2', t === 'dark' ? 'bg-[#181818]' : 'bg-[#eeede9]')}
                      >
                        <div className="mb-2 h-1 w-5 rounded bg-[#7778]" />
                        <div className="mb-2 h-1 w-7 rounded bg-[#7775]" />
                        <div className="h-1 w-6 rounded bg-[#7775]" />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="mb-2 h-1 w-12 rounded bg-[#7778]" />
                        <div className="h-1 w-20 rounded bg-[#7775]" />
                        <div className="mt-7 h-5 w-full rounded-md border border-[#8884]" />
                      </div>
                    </div>
                    <span className="px-1 text-xs capitalize">{t}</span>
                  </button>
                ))}
              </div>
              <h2 className="mb-3 mt-10 text-base font-medium">Keyboard shortcuts</h2>
              {[
                ['New task', 'Ctrl N'],
                ['Search tasks', 'Ctrl K'],
                ['Toggle sidebar', 'Ctrl B'],
                ['Send message', 'Enter'],
                ['New line', 'Shift Enter'],
              ].map(([label, key]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-line/60 py-3 text-sm"
                >
                  <span className="text-muted">{label}</span>
                  <kbd className="rounded-md border border-line px-2 py-0.5 text-xs">{key}</kbd>
                </div>
              ))}
              <div className="mt-9 text-xs leading-6 text-muted">
                Perpetual Desktop · 0.1.0
                <br />
                Built with Tauri, Rust, React, and Tailwind.
                <br />
                Account credentials stay in your operating system vault.
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-medium">{pages.find((p) => p.id === page)?.label}</h2>
                <Button variant="solid" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
              {!policy ? (
                <p className="py-8 text-sm text-muted">
                  {native ? 'Loading settings…' : 'Open the desktop app to configure this feature.'}
                </p>
              ) : (
                <div className="divide-y divide-line/60">
                  {Object.entries(policy)
                    .filter(([key]) => key in labels)
                    .map(([key, value]) =>
                      typeof value === 'boolean' ? (
                        <Toggle
                          key={key}
                          checked={value}
                          onChange={(v) => change(key, v)}
                          label={labels[key][0]}
                          description={labels[key][1]}
                        />
                      ) : (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-4 py-4 text-sm"
                        >
                          <span>{labels[key][0]}</span>
                          {key === 'default_backend' ? (
                            <Select
                              value={String(value)}
                              onChange={(e) => change(key, e.target.value)}
                            >
                              <option value="host">Local machine</option>
                              <option value="docker_sandbox">Docker Sandbox</option>
                            </Select>
                          ) : (
                            <input
                              className="w-48"
                              type={typeof value === 'number' ? 'number' : 'text'}
                              min="0"
                              value={value == null ? '' : String(value)}
                              onChange={(e) =>
                                change(
                                  key,
                                  typeof value === 'number'
                                    ? Number(e.target.value)
                                    : e.target.value || null,
                                )
                              }
                            />
                          )}
                        </label>
                      ),
                    )}
                </div>
              )}
              {page === 'local_model' && policy && (
                <LocalTargets
                  targets={
                    (policy.targets || []) as {
                      provider: string;
                      model: string;
                      base_url?: string | null;
                    }[]
                  }
                  onChange={(v) => change('targets', v)}
                />
              )}
              <div className="mt-7 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void action(async () =>
                      setStatus(
                        await rpc(
                          page === 'cloud'
                            ? 'cloud_availability'
                            : page === 'sandbox'
                              ? 'detect_sandbox_runtime'
                              : 'detect_local_models',
                        ),
                      ),
                    )
                  }
                >
                  <RefreshCw size={14} />
                  Check availability
                </Button>
                {page === 'sandbox' && (
                  <>
                    {[false, true].map((codex) => (
                      <Button
                        key={String(codex)}
                        variant="outline"
                        onClick={() =>
                          void action(async () => {
                            const result = await rpc<{ code: string; url: string }>(
                              codex ? 'codex_sandbox_login' : 'sandbox_login',
                            );
                            setStatus({
                              message: `Use code ${result.code} in the opened browser.`,
                            });
                            await openUrl(result.url);
                          })
                        }
                      >
                        {codex ? 'Sign in Codex' : 'Sign in Docker'}
                      </Button>
                    ))}
                  </>
                )}
              </div>
              {status != null && (
                <pre className="mt-5 overflow-auto whitespace-pre-wrap rounded-xl border border-line p-4 text-xs leading-6 text-muted">
                  {JSON.stringify(status, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function LocalTargets({
  targets,
  onChange,
}: {
  targets: { provider: string; model: string; base_url?: string | null }[];
  onChange: (v: typeof targets) => void;
}) {
  return (
    <div className="mt-7">
      <h3 className="text-sm">Offline model priority</h3>
      {targets.map((target, index) => (
        <div key={index} className="mt-3 flex gap-2">
          <Select
            value={target.provider}
            onChange={(e) =>
              onChange(
                targets.map((t, i) => (i === index ? { ...t, provider: e.target.value } : t)),
              )
            }
          >
            <option value="ollama">Ollama</option>
            <option value="lm_studio">LM Studio</option>
          </Select>
          <input
            aria-label="Local model ID"
            value={target.model}
            onChange={(e) =>
              onChange(targets.map((t, i) => (i === index ? { ...t, model: e.target.value } : t)))
            }
            className="min-w-0 flex-1"
            placeholder="Model ID"
          />
          <Button onClick={() => onChange(targets.filter((_, i) => i !== index))}>Remove</Button>
        </div>
      ))}
      <Button
        variant="outline"
        className="mt-3"
        onClick={() => onChange([...targets, { provider: 'ollama', model: '', base_url: null }])}
      >
        Add local model
      </Button>
    </div>
  );
}
