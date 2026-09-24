import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  PanelLeft,
  Minus,
  Square,
  X,
  Search,
  Plus,
  Settings2,
  UsersRound,
  FolderGit2,
  Clock3,
  GitBranch,
  ArrowUpRight,
  Command,
  SlidersHorizontal,
} from 'lucide-react';
import { native, action } from './lib/api';
import { useStore } from './lib/store';
import { Button, IconButton, Modal, PerpetualMark, cn } from './components/ui';
import { Conversation } from './components/Conversation';
import { Accounts } from './components/Accounts';
import { Settings } from './components/Settings';
import { Projects } from './components/Projects';
import { Activity } from './components/Activity';
import { Plans } from './components/Plans';
export default function App() {
  const store = useStore();
  const [page, setPage] = useState('chat');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [sidebar, setSidebar] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const newTask = () => {
    setSelected(null);
    setPage('chat');
  };
  const selectThread = (id: string) => {
    setSelected(id);
    setPage('chat');
    setSearch(false);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === 'n') {
        e.preventDefault();
        newTask();
      }
      if (e.key === 'b') {
        e.preventDefault();
        setSidebar((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const thread = store.threads.find((t) => t.id === selected);
  const nav = [
    ['projects', FolderGit2, 'Projects'],
    ['plans', GitBranch, 'Plans'],
    ['accounts', UsersRound, 'Accounts'],
    ['activity', Clock3, 'Activity'],
  ] as const;
  return (
    <div className="flex h-dvh overflow-hidden">
      {sidebar && (
        <aside className="flex w-[250px] shrink-0 flex-col bg-sidebar px-3 pb-3">
          <div data-tauri-drag-region className="flex h-[62px] shrink-0 items-center gap-2.5 px-3">
            <PerpetualMark size={24} />
            <span className="text-[16px] font-semibold tracking-tight">Perpetual</span>
            <div className="ml-auto">
              <IconButton label="Hide sidebar (Ctrl+B)" onClick={() => setSidebar(false)}>
                <PanelLeft size={17} />
              </IconButton>
            </div>
          </div>
          <button
            onClick={newTask}
            className="mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-hover"
          >
            <Plus size={18} />
            <span>New task</span>
            <span className="ml-auto text-[11px] text-muted">Ctrl N</span>
          </button>
          <button
            onClick={() => setSearch(true)}
            className="mb-5 flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-hover hover:text-ink"
          >
            <Search size={17} />
            <span>Search tasks</span>
            <span className="ml-auto text-[11px]">Ctrl K</span>
          </button>
          <nav className="space-y-0.5">
            {nav.map(([id, Icon, title]) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors',
                  page === id ? 'bg-hover text-ink' : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                <Icon size={17} strokeWidth={1.7} />
                {title}
                {id === 'accounts' && store.accounts.length > 0 && (
                  <span className="ml-auto text-xs">{store.accounts.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-8 flex items-center justify-between px-3 text-xs text-muted">
            <span>Recent tasks</span>
            <button aria-label="New task" onClick={newTask} className="rounded p-1 hover:bg-hover">
              <Plus size={14} />
            </button>
          </div>
          <div className="mt-2 flex-1 overflow-y-auto">
            {store.threads.map((t) => (
              <button
                key={t.id}
                onClick={() => selectThread(t.id)}
                className={cn(
                  'group my-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px]',
                  selected === t.id && page === 'chat'
                    ? 'bg-hover'
                    : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                <span className="truncate">{t.title}</span>
                {['running', 'waiting_for_limit', 'awaiting_approval'].includes(t.status) && (
                  <span className="ml-auto shrink-0 text-[10px] text-accent">
                    {t.status === 'running' ? 'Running' : 'Waiting'}
                  </span>
                )}
              </button>
            ))}
            {!store.threads.length && (
              <p className="px-3 py-3 text-xs leading-5 text-muted/65">
                Your tasks will appear here.
                <br />
                Pick up right where you left off.
              </p>
            )}
          </div>
          <div className="mx-1 mb-3 rounded-xl border border-line/60 px-3 py-3">
            <div className="flex items-center gap-2 text-xs">
              <GitBranch size={14} className="text-accent" />
              Keep your work moving
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-muted">
              {store.policy?.auto_switch
                ? 'Automatic account switching is on.'
                : 'Connect accounts for seamless continuity.'}
            </p>
            <button
              onClick={() => setPage('accounts')}
              className="mt-2 flex items-center gap-1 text-[11px] text-accent"
            >
              Manage accounts <ArrowUpRight size={12} />
            </button>
          </div>
          <button
            onClick={() => setPage('settings')}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] hover:bg-hover',
              page === 'settings' ? 'bg-hover' : 'text-muted',
            )}
          >
            <Settings2 size={17} />
            Settings<span className="ml-auto text-[10px] text-muted">Desktop</span>
          </button>
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col bg-surface">
        <header
          data-tauri-drag-region
          className="flex h-[58px] shrink-0 items-center border-b border-line/40 pl-5"
        >
          {!sidebar && (
            <IconButton label="Show sidebar" onClick={() => setSidebar(true)}>
              <PanelLeft size={17} />
            </IconButton>
          )}
          <span className="ml-2 truncate text-[13px] text-muted">
            {page === 'chat'
              ? thread?.title || 'New task'
              : page.charAt(0).toUpperCase() + page.slice(1)}
          </span>
          {!native && (
            <span className="ml-3 rounded-md border border-line px-2 py-0.5 text-[10px] text-muted">
              Browser preview
            </span>
          )}
          <div className="ml-auto flex h-full items-center pr-2">
            {native && (
              <>
                <IconButton
                  label="Minimize"
                  onClick={() => void action(() => getCurrentWindow().minimize())}
                >
                  <Minus size={15} />
                </IconButton>
                <IconButton
                  label="Maximize"
                  onClick={() => void action(() => getCurrentWindow().toggleMaximize())}
                >
                  <Square size={12} />
                </IconButton>
                <IconButton
                  label="Close"
                  onClick={() => void action(() => getCurrentWindow().close())}
                >
                  <X size={16} />
                </IconButton>
              </>
            )}
          </div>
        </header>
        {store.error && (
          <div
            role="alert"
            className="flex items-center gap-3 border-b border-amber-600/20 bg-amber-500/5 px-6 py-2 text-xs text-amber-300"
          >
            <span className="flex-1">{store.error}</span>
            <Button onClick={() => void store.refresh()}>Retry</Button>
          </div>
        )}
        {page === 'chat' ? (
          <Conversation
            onNavigate={(name) => (name === 'search' ? setSearch(true) : setPage(name))}
            key={selected || 'new'}
            thread={thread}
            onSelect={selectThread}
            onAccounts={() => setPage('accounts')}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1000px] px-10 py-10">
              {page === 'accounts' && <Accounts />}
              {page === 'settings' && <Settings theme={theme} setTheme={setTheme} />}
              {page === 'projects' && <Projects />}
              {page === 'activity' && <Activity />}
              {page === 'plans' && <Plans onSelect={selectThread} />}
            </div>
          </div>
        )}
      </main>
      <Modal
        open={search}
        onOpenChange={setSearch}
        title="Find a task"
        description="Search your persistent sessions."
      >
        <div className="relative">
          <Search size={17} className="absolute left-3 top-3 text-muted" />
          <input
            autoFocus
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or objective…"
            className="w-full !pl-10"
          />
        </div>
        <div className="mt-4 max-h-80 overflow-y-auto">
          {store.threads
            .filter((t) => `${t.title} ${t.objective}`.toLowerCase().includes(query.toLowerCase()))
            .map((t) => (
              <button
                key={t.id}
                onClick={() => selectThread(t.id)}
                className="flex w-full items-center justify-between rounded-lg p-3 text-left text-sm hover:bg-hover"
              >
                {t.title}
                <span className="text-xs text-muted">{t.status.replaceAll('_', ' ')}</span>
              </button>
            ))}
          {!store.threads.length && (
            <p className="py-7 text-center text-sm text-muted">
              No tasks yet. Start with a new task.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
