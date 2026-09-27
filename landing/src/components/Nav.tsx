import { useEffect, useState } from 'react';
import { REPO } from '../lib/site';
import { DownloadButton } from './DownloadButton';
import { GithubLogo, Mark } from './Mark';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
];

/**
 * Full width over the hero; once you scroll it gathers into a floating,
 * frosted bar that sits just below the top of the window.
 */
export function Nav() {
  const [floating, setFloating] = useState(false);
  useEffect(() => {
    const onScroll = () => setFloating(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 px-3 transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-5 ${
        floating ? 'pt-3' : 'pt-0'
      }`}
    >
      <nav
        className={`relative mx-auto flex items-center gap-8 rounded-2xl transition-[max-width,height,padding,background-color,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          floating
            ? 'h-[52px] max-w-[880px] bg-[#141514]/70 pr-2 pl-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.06)_inset,0_18px_50px_-18px_rgba(0,0,0,0.85)] backdrop-blur-lg'
            : 'h-16 max-w-6xl bg-transparent px-2 shadow-[0_0_0_1px_rgba(255,255,255,0)] sm:px-3'
        }`}
      >
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight"
        >
          <Mark size={19} />
          Perpetual
        </a>
        <div
          className={`hidden items-center text-[14px] text-white/75 transition-[gap] duration-500 md:flex ${
            floating ? 'mx-auto gap-1' : 'mr-auto gap-2'
          }`}
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
          <a
            href={REPO}
            aria-label="Perpetual on GitHub"
            className="flex size-9 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <GithubLogo />
          </a>
          <DownloadButton size="sm" />
        </div>
      </nav>
    </header>
  );
}
