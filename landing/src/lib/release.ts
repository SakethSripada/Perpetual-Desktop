import { REPO, type Platform } from './site';

type DownloadPlatform = Exclude<Platform, 'other'>;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  html_url: string;
  assets: GitHubAsset[];
}

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface Release {
  url: string;
  checksums: ReleaseAsset;
  downloads: Record<DownloadPlatform, ReleaseAsset>;
}

const API = 'https://api.github.com/repos/SakethSripada/Perpetual-Desktop/releases/latest';

function validAsset(asset: GitHubAsset): boolean {
  return (
    typeof asset.name === 'string' &&
    typeof asset.size === 'number' &&
    asset.size > 0 &&
    typeof asset.browser_download_url === 'string' &&
    asset.browser_download_url.startsWith(`${REPO}/releases/download/`)
  );
}

function selectAsset(assets: GitHubAsset[], pattern: RegExp): ReleaseAsset | null {
  const matches = assets.filter((asset) => validAsset(asset) && pattern.test(asset.name));
  // An ambiguous release must not silently send someone the wrong installer.
  if (matches.length !== 1) return null;
  const { name, browser_download_url: url, size } = matches[0];
  return { name, url, size };
}

export function parseRelease(release: GitHubRelease): Release | null {
  if (!release.html_url?.startsWith(`${REPO}/releases/tag/`) || !Array.isArray(release.assets))
    return null;
  const windows = selectAsset(release.assets, /x64-setup\.exe$/i);
  const mac = selectAsset(release.assets, /universal\.dmg$/i);
  const checksums = selectAsset(release.assets, /^SHA256SUMS\.txt$/);
  if (!windows || !mac || !checksums) return null;
  return { url: release.html_url, checksums, downloads: { windows, mac } };
}

let releasePromise: Promise<Release | null> | null = null;

/** A missing, private, or incomplete release is never presented as a download. */
export function latestRelease(): Promise<Release | null> {
  if (!releasePromise) {
    releasePromise = fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: GitHubRelease | null) => (data ? parseRelease(data) : null))
      .catch(() => null);
  }
  return releasePromise;
}
