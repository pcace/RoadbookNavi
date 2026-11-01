import i18n from './ui/i18n';
import { confirm } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { openRoadbookFile } from './files';
import { importRn2 } from './rn2';
import { repository } from './services';

export async function importRoadbook(): Promise<string | null> {
  const text = await openRoadbookFile();
  if (text === null) return null;
  const project = importRn2(text);
  const confirmImport = isTauri()
    ? confirm
    : async (message: string) => window.confirm(message);
  const accepted = await confirmImport(i18n.t('import.confirm'), {
    title: i18n.t('import.title'),
    kind: 'info',
    okLabel: i18n.t('import.action'),
    cancelLabel: i18n.t('common.cancel'),
  });
  if (!accepted) return null;
  await repository.save(project);
  return i18n.t('import.success', {
    name: project.name,
    count: project.entries.length,
  });
}
