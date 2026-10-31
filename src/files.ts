import { isTauri } from '@tauri-apps/api/core';
import { open, save, type DialogFilter } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function openRoadbookFile(): Promise<string | null> {
  if (isTauri()) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Rally Navigator', extensions: ['rn2'] }],
    });
    return path ? readTextFile(path) : null;
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rn2';
    input.hidden = true;
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (file) file.text().then(resolve, reject);
      else resolve(null);
    };
    document.body.append(input);
    input.click();
  });
}

export async function saveFile(
  defaultPath: string,
  filters: DialogFilter[],
  content: () => Promise<string | Uint8Array>
): Promise<boolean> {
  const path = isTauri() ? await save({ defaultPath, filters }) : defaultPath;
  if (!path) return false;
  const data = await content();
  if (isTauri()) {
    if (typeof data === 'string') await writeTextFile(path, data);
    else await writeFile(path, data);
  } else {
    const blob = new Blob(
      [typeof data === 'string' ? data : new Uint8Array(data)],
      {
        type: defaultPath.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream',
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultPath.replace(/[\\/:*?"<>|]/g, '-');
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return true;
}
