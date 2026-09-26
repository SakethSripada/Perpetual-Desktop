export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** The modifier people press for shortcuts on this platform. */
export const mod = isMac ? '⌘' : 'Ctrl';

/** Shortcut keys as they're written on this platform, e.g. ["⌘", "K"]. */
export const keys = (...rest: string[]) => [mod, ...rest];

/** One-line shortcut label, e.g. "⌘K" or "Ctrl K". */
export const shortcut = (key: string) => (isMac ? `⌘${key}` : `Ctrl ${key}`);

export const credentialStore = isMac ? 'your macOS Keychain' : 'Windows Credential Manager';
