import { open, confirm } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { importRn2 } from './rn2';
import { repository } from './services';

export async function importRoadbook(): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Rally Navigator', extensions: ['rn2'] }],
  });
  if (!path) return null;
  const project = importRn2(await readTextFile(path));
  const accepted = await confirm(
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
