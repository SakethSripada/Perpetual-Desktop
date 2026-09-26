import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Toaster } from 'sonner';
import {
  PanelLeft,
  Minus,
  Square,
  Copy,
  X,
  Search,
  SquarePen,
  Settings2,
  UsersRound,
  FolderGit2,
  History,
  Workflow,
} from 'lucide-react';
import { native, action } from './lib/api';
import { useStore } from './lib/store';
import { relativeTime, statusInfo } from './lib/format';
import { isMac, shortcut } from './lib/platform';
import { Button, Dot, IconButton, Kbd, Modal, PerpetualMark, cn } from './components/ui';
import { SidebarAccounts } from './components/AccountSwitcher';
import { Conversation } from './components/Conversation';
import { Accounts } from './components/Accounts';
import { Settings } from './components/Settings';
import { Projects } from './components/Projects';
import { Activity } from './components/Activity';
import { Workflows } from './components/Workflows';

export type Page = 'chat' | 'projects' | 'workflows' | 'accounts' | 'activity' | 'settings';
export type Theme = 'dark' | 'light' | 'system';

const PAGE_TITLES: Record<Page, string> = {
  chat: 'New task',
  projects: 'Projects',
  workflows: 'Workflows',
  accounts: 'Accounts',
  activity: 'Activity',
  settings: 'Settings',
};

function readTheme(): Theme {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

function useResolvedTheme(theme: Theme) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export default function App() {
  const store = useStore();
  const [page, setPage] = useState<Page>('chat');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [addAccount, setAddAccount] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [maximized, setMaximized] = useState(false);
  const resolved = useResolvedTheme(theme);

  const newTask = () => {
    setSelected(null);
    setPage('chat');
  };
  const selectThread = (id: string | null) => {
    setSelected(id || null);
    setPage('chat');
    setSearch(false);
  };
  const navigate = (next: string) => {
    if (next === 'search') setSearch(true);
    else if (next in PAGE_TITLES) setPage(next as Page);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Storage can be unavailable; the theme still applies for this session.
    }
  }, [theme, resolved]);

  useEffect(() => {
    if (!native) return;
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const off = win.onResized(() => void win.isMaximized().then(setMaximized));
    return () => void off.then((fn) => fn());
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      } else if (k === 'n' && !e.shiftKey) {
        e.preventDefault();
        newTask();
      } else if (k === 'b') {
        e.preventDefault();
        setSidebar((v) => !v);
      } else if (k === ',') {
        e.preventDefault();
        setPage('settings');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // A deleted or missing task falls back to a new one.
  const thread = store.threads.find((t) => t.id === selected);
  useEffect(() => {
    if (selected && !store.loading && store.revision > 0 && !thread) setSelected(null);
  }, [selected, thread, store.loading, store.revision]);

  const nav = [
    ['projects', FolderGit2, 'Projects'],
    ['workflows', Workflow, 'Workflows'],
    ['activity', History, 'Activity'],
    ['accounts', UsersRound, 'Accounts'],
  ] as const;
  const title = page === 'chat' ? thread?.title || 'New task' : PAGE_TITLES[page];

  return (
    <div className="flex h-full overflow-hidden">
      {sidebar && (
        <aside className="flex w-[248px] shrink-0 flex-col bg-sidebar">
          <div
            data-tauri-drag-region
            className={cn(
              'flex h-12 shrink-0 items-center gap-2 pr-2',
              isMac ? 'pl-[88px]' : 'pl-4',
            )}
          >
            <PerpetualMark size={18} />
            <span data-tauri-drag-region className="text-[14px] font-semibold tracking-tight">
              Perpetual
            </span>
            <IconButton
              className="ml-auto"
              label={`Hide sidebar (${shortcut('B')})`}
              onClick={() => setSidebar(false)}
            >
              <PanelLeft size={16} />
            </IconButton>
          </div>
          <div className="space-y-0.5 px-2 pt-1">
            <SidebarButton
              icon={SquarePen}
              label="New task"
              hint={shortcut('N')}
              active={page === 'chat' && !selected}
              onClick={newTask}
            />
            <SidebarButton
              icon={Search}
              label="Search"
              hint={shortcut('K')}
              onClick={() => setSearch(true)}
            />
          </div>
          <nav className="mt-3 space-y-0.5 px-2">
            {nav.map(([id, Icon, label]) => (
              <SidebarButton
                key={id}
                icon={Icon}
                label={label}
                active={page === id}
                onClick={() => setPage(id)}
              />
            ))}
          </nav>
          <div className="mt-5 px-5 pb-1 text-[11px] font-medium text-faint">Tasks</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {store.threads.map((t) => {
              const status = statusInfo(t.status);
              const flagged = status.live || status.tone === 'warning' || status.tone === 'danger';
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  title={t.title}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] transition-colors',
                    selected === t.id && page === 'chat'
                      ? 'bg-hover text-ink'
                      : 'text-muted hover:bg-hover hover:text-ink',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{t.title || 'Untitled task'}</span>
                  {flagged && <Dot tone={status.tone} live={status.live} />}
                </button>
              );
            })}
            {!store.threads.length && !store.loading && (
              <p className="px-3 py-1.5 text-xs text-faint">No tasks yet</p>
            )}
          </div>
          <div className="space-y-0.5 border-t border-line/60 p-2">
            <SidebarAccounts
              onManage={() => setPage('accounts')}
              onAdd={() => {
                setPage('accounts');
                setAddAccount(true);
              }}
            />
            <SidebarButton
              icon={Settings2}
              label="Settings"
              active={page === 'settings'}
              onClick={() => setPage('settings')}
            />
          </div>
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col bg-surface">
        <header
          data-tauri-drag-region
          className={cn(
            'flex h-12 shrink-0 items-center gap-1 border-b border-line/50 pl-3',
            isMac && !sidebar && 'pl-[84px]',
          )}
        >
          {!sidebar && (
            <IconButton label={`Show sidebar (${shortcut('B')})`} onClick={() => setSidebar(true)}>
              <PanelLeft size={16} />
            </IconButton>
          )}
          <span data-tauri-drag-region className="ml-2 min-w-0 truncate text-[13px] text-muted">
            {title}
          </span>
          {!native && (
            <span className="ml-2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-faint">
              Preview
            </span>
          )}
          {native && !isMac && (
            <div className="ml-auto flex h-full items-stretch">
              <WindowButton label="Minimize" onClick={() => getCurrentWindow().minimize()}>
                <Minus size={15} />
              </WindowButton>
              <WindowButton
                label={maximized ? 'Restore' : 'Maximize'}
                onClick={() => getCurrentWindow().toggleMaximize()}
              >
                {maximized ? <Copy size={12} className="-scale-x-100" /> : <Square size={12} />}
              </WindowButton>
              <WindowButton label="Close" close onClick={() => getCurrentWindow().close()}>
                <X size={16} />
              </WindowButton>
            </div>
          )}
        </header>
        {store.error && (
          <div
            role="alert"
            className="flex items-center gap-3 border-b border-line/50 bg-warning/10 px-5 py-2 text-xs text-warning"
          >
            <span className="min-w-0 flex-1 truncate">{store.error}</span>
            <Button size="sm" variant="secondary" onClick={() => void store.refresh()}>
              Try again
            </Button>
          </div>
        )}
        {page === 'chat' ? (
          <Conversation
            key={selected || 'new'}
            thread={thread}
            onSelect={selectThread}
            onNavigate={navigate}
          />
        ) : (
          <div key={page} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[880px] px-6 py-9 sm:px-10">
              {page === 'accounts' && <Accounts addOpen={addAccount} setAddOpen={setAddAccount} />}
              {page === 'settings' && <Settings theme={theme} setTheme={setTheme} />}
              {page === 'projects' && <Projects />}
              {page === 'activity' && <Activity onSelect={selectThread} />}
              {page === 'workflows' && <Workflows onSelect={selectThread} />}
            </div>
          </div>
        )}
      </main>
      <SearchDialog open={search} onOpenChange={setSearch} onSelect={selectThread} />
      <Toaster
        theme={resolved}
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: '!bg-elevated !border-line !text-ink !rounded-xl !shadow-xl',
            description: '!text-muted',
          },
        }}
      />
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: typeof Search;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-8 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors',
        active ? 'bg-hover text-ink' : 'text-muted hover:bg-hover hover:text-ink',
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span>{label}</span>
      {hint && (
        <span className="ml-auto text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
          {hint}
        </span>
      )}
    </button>
  );
}

function WindowButton({
  label,
  close,
  onClick,
  children,
}: {
  label: string;
  close?: boolean;
  onClick: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => void action(onClick)}
      className={cn(
        'flex w-11 items-center justify-center text-muted transition-colors',
        close ? 'hover:bg-[#c42b1c] hover:text-white' : 'hover:bg-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function SearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.threads
      .filter((t) => !q || `${t.title} ${t.objective}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [store.threads, query]);
  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }, [open]);
  useEffect(() => setIndex(0), [query]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Search tasks" width={560}>
      <div className="relative">
        <Search size={15} className="absolute top-2.5 left-3 text-faint" />
        <input
          autoFocus
          aria-label="Search tasks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results[index]) {
              e.preventDefault();
              onSelect(results[index].id);
            }
          }}
          placeholder="Search by title or request"
          className="w-full !pl-9"
        />
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {results.map((t, i) => {
          const status = statusInfo(t.status);
          return (
            <button
              key={t.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(t.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px]',
                i === index && 'bg-hover',
              )}
            >
              <Dot tone={status.tone} live={status.live} />
              <span className="min-w-0 flex-1 truncate">{t.title || 'Untitled task'}</span>
              <span className="shrink-0 text-xs text-faint">{relativeTime(t.updated_at)}</span>
            </button>
          );
        })}
        {!results.length && (
          <p className="py-8 text-center text-[13px] text-muted">
            {store.threads.length ? 'No matching tasks' : 'No tasks yet'}
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> to open
        </span>
      </div>
    </Modal>
  );
}
