import { useEffect, useState } from 'react';
import { REPO } from '../lib/site';
import { DownloadButton } from './DownloadButton';
import { GithubLogo, Mark } from './Mark';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled ? 'border-b border-line bg-bg/70 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <Mark size={19} />
          Perpetual
        </a>
        <div className="hidden items-center gap-7 text-[14px] text-muted md:flex">
          <a className="transition-colors hover:text-ink" href="#how">
            How it works
          </a>
          <a className="transition-colors hover:text-ink" href="#features">
            Features
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO}
            aria-label="Perpetual on GitHub"
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <GithubLogo />
          </a>
          <DownloadButton size="sm" />
        </div>
      </nav>
    </header>
  );
}
