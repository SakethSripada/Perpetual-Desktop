import { useEffect, useState } from 'react';
import { useRelease } from '../lib/useRelease';
import {
  DIRECT_GITHUB_DOWNLOADS,
  DIRECT_RELEASE,
  PLATFORM_NAME,
  detectPlatform,
  type Platform,
} from '../lib/site';
import { useDownloadFlow } from './DownloadFlow';
import { AppleLogo, WindowsLogo } from './Mark';

type Props = {
  size?: 'sm' | 'lg';
  className?: string;
};

const buttonStyle = (small: boolean, className: string) =>
  `group relative inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-bg shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_16px_40px_-12px_rgba(255,255,255,0.45)] active:translate-y-0 ${
    small ? 'h-8 px-3.5 text-[13px]' : 'h-12 px-6 text-[15px]'
  } ${className}`;

/** For now, lead everyone to the two explicit GitHub downloads and safety notes. */
export function DownloadButton(props: Props) {
  return DIRECT_GITHUB_DOWNLOADS ? (
    <DirectDownloadButton {...props} />
  ) : (
    <AutomaticDownloadButton {...props} />
  );
}

function DirectDownloadButton({ size = 'lg', className = '' }: Props) {
  const { platform, showInstructions } = useDownloadFlow();
  const small = size === 'sm';
  if (platform === 'other') {
    return (
      <a href="#download" className={buttonStyle(small, className)}>
        {small ? 'Downloads' : 'Choose your download'}
      </a>
    );
  }
  const asset = DIRECT_RELEASE[platform];
  return (
    <a
      href={asset.url}
      onClick={() => showInstructions(platform)}
      className={buttonStyle(small, className)}
    >
      {platform === 'windows' ? (
        <WindowsLogo size={small ? 12 : 15} />
      ) : (
        <AppleLogo size={small ? 13 : 16} />
      )}
      {small ? 'Download' : `Download for ${PLATFORM_NAME[platform]}`}
    </a>
  );
}

/** Kept for when signed releases can use automatic platform selection again. */
function AutomaticDownloadButton({ size = 'lg', className = '' }: Props) {
  const [platform, setPlatform] = useState<Platform>('other');
  const { release, loading } = useRelease();
  useEffect(() => setPlatform(detectPlatform()), []);
  const small = size === 'sm';
  const asset = platform === 'other' ? null : release?.downloads[platform];
  return (
    <a href={asset?.url ?? '#download'} className={buttonStyle(small, className)}>
      {platform === 'windows' && <WindowsLogo size={small ? 12 : 15} />}
      {platform === 'mac' && <AppleLogo size={small ? 13 : 16} />}
      {small
        ? release
          ? 'Download'
          : 'Downloads'
        : loading
          ? 'Checking downloads…'
          : !release
            ? 'Downloads coming soon'
            : platform === 'other'
              ? 'Choose your download'
              : `Download for ${PLATFORM_NAME[platform]}`}
    </a>
  );
}
