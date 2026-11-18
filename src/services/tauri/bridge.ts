import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog';
import { writeText as clipboardWriteText } from '@tauri-apps/plugin-clipboard-manager';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { openPath } from '@tauri-apps/plugin-opener';

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return invoke<T>(command, args);
}

export async function copyTextNative(text: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await clipboardWriteText(text);
      return;
    } catch {
      // Fallback below
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === 'granted';
      }
      if (granted) {
        sendNotification({ title, body });
      }
      return;
    } catch {
      // Ignore if permission denied
    }
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export async function pickNativeFile(options: {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await dialogOpen({
    title: options.title,
    multiple: false,
    filters: options.filters,
  });
  return typeof selected === 'string' ? selected : null;
}

export async function pickNativeDirectory(title = 'Choose HomeVault Storage Folder'): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await dialogOpen({
    title,
    directory: true,
    multiple: false,
  });
  return typeof selected === 'string' ? selected : null;
}

export async function saveNativeFile(options: {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return dialogSave({
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });
}

export async function openLocalPathNative(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await openPath(path);
  }
}

export async function windowMinimize(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().minimize();
  }
}

export async function windowToggleMaximize(): Promise<boolean> {
  if (isTauriRuntime()) {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    return win.isMaximized();
  }
  return false;
}

export async function windowIsMaximized(): Promise<boolean> {
  if (isTauriRuntime()) {
    return getCurrentWindow().isMaximized();
  }
  return false;
}

export async function windowClose(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().close();
  }
}
