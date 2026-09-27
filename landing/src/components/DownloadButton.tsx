import { useEffect, useState } from 'react';
import { PLATFORM_NAME, RELEASES, detectPlatform, type Platform } from '../lib/site';
import { AppleLogo, WindowsLogo } from './Mark';

/** The primary call to action, labelled for the visitor's own platform. */
export function DownloadButton({ size = 'lg', className = '' }: { size?: 'sm' | 'lg'; className?: string }) {
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => setPlatform(detectPlatform()), []);
  const small = size === 'sm';
  return (
    <a
      href={RELEASES}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-bg shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_16px_40px_-12px_rgba(255,255,255,0.45)] active:translate-y-0 ${
        small ? 'h-8 px-3.5 text-[13px]' : 'h-12 px-6 text-[15px]'
      } ${className}`}
    >
      {platform === 'windows' && <WindowsLogo size={small ? 12 : 15} />}
      {platform === 'mac' && <AppleLogo size={small ? 13 : 16} />}
      {small ? 'Download' : platform === 'other' ? 'Download Perpetual' : `Download for ${PLATFORM_NAME[platform]}`}
    </a>
  );
}
