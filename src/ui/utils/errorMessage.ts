/**
 * Tauri command rejections are usually strings instead of JavaScript Error
 * instances. Preserve their native diagnostic text for the user interface.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}
