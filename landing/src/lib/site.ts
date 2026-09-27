export const REPO = 'https://github.com/SakethSripada/Perpetual-Desktop';
export const RELEASES = `${REPO}/releases/latest`;

export type Platform = 'windows' | 'mac' | 'other';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const hint =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.userAgent;
  if (/win/i.test(hint)) return 'windows';
  if (/mac/i.test(hint)) return 'mac';
  return 'other';
}

export const PLATFORM_NAME: Record<Exclude<Platform, 'other'>, string> = {
  windows: 'Windows',
  mac: 'macOS',
};
