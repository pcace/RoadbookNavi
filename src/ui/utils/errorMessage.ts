import i18n from '../i18n';
import de from '../i18n/locales/de/common.json';
import en from '../i18n/locales/en/common.json';

// Core algorithms and native commands return fixed diagnostic messages.
// Translate their known messages at the UI boundary, keeping unknown technical
// details intact so that failures can still be diagnosed.
const diagnosticKeys = new Map(
  [de.diagnostics, en.diagnostics].flatMap(messages =>
    Object.entries(messages).map(([key, message]) => [message, key] as const)
  )
);

function translateMessage(raw: string): string {
  const message = raw.replace(/^Error:\s*/, '').trim();
  const note = message.indexOf(' Diagnostic file: ');
  if (note >= 0) {
    return `${translateMessage(message.slice(0, note))} ${i18n.t('diagnostics.diagnosticFile')}: ${message.slice(note + ' Diagnostic file: '.length)}`;
  }
  const key = diagnosticKeys.get(message);
  if (key) return i18n.t(`diagnostics.${key}`);
  if (message === 'Geolocation is not supported')
    return i18n.t('gps.unsupported');
  if (message === 'Kein GPS-Signal empfangen') return i18n.t('gps.timeout');
  const geocoding = /^geocoding\.([\w]+)(?::(.*))?$/.exec(message);
  if (geocoding) {
    const key = `settings:geocoding.errors.${geocoding[1]}`;
    if (i18n.exists(key)) return i18n.t(key, { status: geocoding[2] });
  }
  const segment = /^Routingsegment (.+) wurde nicht vollständig geladen$/.exec(
    message
  );
  if (segment)
    return i18n.t('diagnostics.incompleteSegment', { name: segment[1] });
  const coordinates = /^Track contains (\d+) invalid coordinates$/.exec(
    message
  );
  if (coordinates)
    return i18n.t('diagnostics.invalidCoordinates', {
      count: Number(coordinates[1]),
    });
  const path =
    /^trackPath contains (\d+) invalid coordinates after lineString creation$/.exec(
      message
    );
  if (path)
    return i18n.t('diagnostics.invalidPathCoordinates', {
      count: Number(path[1]),
    });
  // Native routing failures append paths and engine output. Translate only the
  // application-owned prefix and retain those diagnostics verbatim.
  for (const key of [
    'javaMissing',
    'engineMissing',
    'engineStartFailed',
    'engineInvalidJson',
  ] as const) {
    const prefix = en.diagnostics[key];
    if (message.startsWith(prefix))
      return i18n.t(`diagnostics.${key}`) + message.slice(prefix.length);
  }
  if (message.startsWith('BRouter exited with ')) {
    return `${i18n.t('diagnostics.engineExited')}: ${message.slice('BRouter exited with '.length)}`;
  }
  return raw;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return translateMessage(error.message);
  }
  if (typeof error === 'string' && error.trim()) {
    return translateMessage(error);
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return translateMessage(error.message);
  }
  return fallback;
}

export function getGpsErrorMessage(
  error: Pick<GeolocationPositionError, 'code' | 'message'>
): string {
  const keys: Record<number, string> = {
    1: 'gps.permissionDenied',
    2: 'gps.unavailable',
    3: 'gps.timeout',
  };
  const reason = i18n.t(keys[error.code] || 'gps.error');
  // These standard codes already explain the failure. Other native errors may
  // carry useful additional detail, such as a permission denial in a WebView.
  if (error.code === 1 || error.code === 3) return reason;
  const detail = getErrorMessage(error, '');
  return detail && detail !== reason ? `${reason} (${detail})` : reason;
}
