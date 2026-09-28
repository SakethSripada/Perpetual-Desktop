import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { errorMessage } from './format';
import type { AppEvent } from './types';

export const native = isTauri();

export async function rpc<T = void>(name: string, payload?: unknown): Promise<T> {
  if (!native) throw new Error('This action is available in the Perpetual desktop app.');
  const result = await invoke<string | Record<string, T>>('request', {
    request: payload === undefined ? name : { [name]: payload },
  });
  return typeof result === 'string' ? (undefined as T) : Object.values(result)[0];
}

export function subscribe(refresh: (event?: AppEvent) => void) {
  if (!native) return Promise.resolve(() => {});
  return Promise.all([
    listen<{ event: AppEvent }>('perpetual-event', ({ payload }) => refresh(payload.event)),
    listen('perpetual-refresh', () => refresh()),
  ]).then((unlisten) => () => unlisten.forEach((fn) => fn()));
}

/** Runs an action, reporting failure (and optionally success) as a toast. */
export async function action<T>(run: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const value = await run();
    if (success) toast.success(success);
    return value;
  } catch (error) {
    toast.error(errorMessage(error));
    return undefined;
  }
}

/** Starts browser sign-in in the background, or opens interactive CLI tooling. */
export async function signIn(accountId: string, tooling = false) {
  if (!native) throw new Error('Sign-in is available in the Perpetual desktop app.');
  const mode = await invoke<'browser' | 'terminal'>('sign_in', { accountId, tooling });
  if (!tooling)
    toast.info(
      mode === 'browser'
        ? 'Finish signing in in your browser.'
        : 'Finish signing in in the window that opened.',
    );
}
