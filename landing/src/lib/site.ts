export const REPO = 'https://github.com/SakethSripada/Perpetual-Desktop';
export const RELEASES = `${REPO}/releases/latest`;

// Temporary public download experience while the installers are unsigned.
// Set this to false to restore the release-manifest and OS-detection flow.
export const DIRECT_GITHUB_DOWNLOADS = true;

export const DIRECT_RELEASE = {
  tag: 'v0.1.0',
  url: `${REPO}/releases/tag/v0.1.0`,
  checksums: `${REPO}/releases/download/v0.1.0/SHA256SUMS.txt`,
  windows: {
    name: 'Perpetual_0.1.0_x64-setup.exe',
    url: `${REPO}/releases/download/v0.1.0/Perpetual_0.1.0_x64-setup.exe`,
    sha256: '62e5a76eaa613eda5ea4123f41e0adfdadad1d62ea00d45996fa3c60ad9bfa2f',
  },
  mac: {
    name: 'Perpetual_0.1.0_universal.dmg',
    url: `${REPO}/releases/download/v0.1.0/Perpetual_0.1.0_universal.dmg`,
    sha256: '870edee411aa26e17e452043b11053197e4c4a3974db50559547b5ee52fb1589',
  },
} as const;

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
