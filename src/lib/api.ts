import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { AppEvent } from './types';
export const native = isTauri();
export async function rpc<T = void>(name: string, payload?: unknown): Promise<T> {
  if (!native)
    throw new Error(
      'Open the desktop app to connect accounts and run tasks. This browser is a visual preview.',
    );
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
export async function action<T>(run: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const value = await run();
    if (success) toast.success(success);
    return value;
  } catch (error) {
    toast.error(String(error));
    return undefined;
  }
}
export async function signIn(accountId: string, tooling = false) {
  if (!native) throw new Error('Sign-in is available in the desktop app.');
  await invoke('sign_in', { accountId, tooling });
  toast.info('Finish signing in in the provider terminal, then refresh Accounts.');
}
