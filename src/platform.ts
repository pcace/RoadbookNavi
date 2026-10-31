import { invoke as nativeInvoke, isTauri } from '@tauri-apps/api/core';

// Native builds keep their existing commands; browsers load only the web adapter.
export function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return isTauri()
    ? nativeInvoke<T>(command, args)
    : import('./web').then(web => web.invokeWeb<T>(command, args));
}
