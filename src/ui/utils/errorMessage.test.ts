import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errorMessage';

describe('getErrorMessage', () => {
  it('preserves native Tauri command errors', () => {
    expect(getErrorMessage('Bundled Java runtime is missing', 'fallback')).toBe(
      'Bundled Java runtime is missing'
    );
  });

  it('supports JavaScript errors and a safe fallback', () => {
    expect(getErrorMessage(new Error('route failed'), 'fallback')).toBe(
      'route failed'
    );
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
