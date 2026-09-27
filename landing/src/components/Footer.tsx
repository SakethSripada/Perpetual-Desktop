import { REPO } from '../lib/site';
import { Mark } from './Mark';

export function Footer() {
  const links = [
    ['GitHub', REPO],
    ['Releases', `${REPO}/releases`],
    ['License', `${REPO}/blob/main/LICENSE`],
    ['Security', `${REPO}/blob/main/SECURITY.md`],
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[13px] text-faint sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-2.5 text-muted">
          <Mark size={16} />
          <span>Perpetual</span>
          <span className="text-faint">© 2026</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 sm:ml-auto">
          {links.map(([label, href]) => (
            <a key={label} href={href} className="transition-colors hover:text-ink">
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
