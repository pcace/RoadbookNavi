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
  const accepted = await confirmImport(
    'RN2 wird vollständig gespeichert und wieder exportiert. Fehlende Symbole erscheinen als Namen. Entfernungen stammen aus dem GPS-Track; manuelle RN2-Distanzkorrekturen und Smart Tags werden noch nicht ausgewertet. Für eine Fahrt bitte mit dem Original abgleichen. Importieren?',
    {
      title: 'RN2 importieren',
      kind: 'info',
      okLabel: 'Importieren',
      cancelLabel: 'Abbrechen',
    }
  );
  if (!accepted) return null;
  await repository.save(project);
  return `${project.name} importiert (${project.entries.length} Einträge).`;
}
