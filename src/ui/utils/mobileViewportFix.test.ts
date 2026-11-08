import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMobileViewportFix } from './mobileViewportFix';

const createVisualViewport = () =>
  Object.assign(new EventTarget(), {
    height: 700,
    offsetTop: 0,
    scale: 1,
  });

function createBrowser(viewport?: ReturnType<typeof createVisualViewport>) {
  const properties = new Map<string, string>();
  const setProperty = vi.fn((name: string, value: string) => {
    properties.set(name, value);
  });
  const browser = Object.assign(new EventTarget(), {
    innerHeight: 800,
    visualViewport: viewport,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', {
    documentElement: {
      style: {
        setProperty,
        getPropertyValue: (name: string) => properties.get(name) ?? '',
        removeProperty: (name: string) => {
          const previous = properties.get(name) ?? '';
          properties.delete(name);
          return previous;
        },
      },
    },
  });
  return { browser, properties, setProperty };
}

describe('mobile viewport layout', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps controls inside the visible height when browser bars change without a window resize', () => {
    const viewport = createVisualViewport();
    const { browser, properties } = createBrowser(viewport);
    cleanup = initMobileViewportFix();

    expect(properties.get('--vh')).toBe('7px');
    viewport.height = 600;
    viewport.dispatchEvent(new Event('resize'));
    expect(browser.innerHeight).toBe(800);
    expect(properties.get('--vh')).toBe('6px');

    viewport.height = 750;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('7.5px');
  });

  it('follows the keyboard viewport and restores the app after the keyboard closes', () => {
    const viewport = createVisualViewport();
    const { properties } = createBrowser(viewport);
    cleanup = initMobileViewportFix();

    viewport.height = 300;
    viewport.offsetTop = 180;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('3px');
    expect(properties.get('--viewport-offset-top')).toBe('180px');

    // Safari can move the visual viewport again after focusing an input.
    viewport.offsetTop = 220;
    viewport.dispatchEvent(new Event('scroll'));
    expect(properties.get('--viewport-offset-top')).toBe('220px');

    viewport.height = 700;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('7px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');
  });

  it('falls back to window dimensions and refreshes them when a page is restored', () => {
    const { browser, properties } = createBrowser();
    cleanup = initMobileViewportFix();
    expect(properties.get('--vh')).toBe('8px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');

    browser.innerHeight = 600;
    browser.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('6px');

    browser.innerHeight = 750;
    browser.dispatchEvent(new Event('pageshow'));
    expect(properties.get('--vh')).toBe('7.5px');
  });

  it('lets pinch zoom magnify the app without reflowing it into the zoomed viewport', () => {
    const viewport = createVisualViewport();
    const { browser, properties } = createBrowser(viewport);
    cleanup = initMobileViewportFix();

    viewport.scale = 2;
    viewport.height = 350;
    viewport.offsetTop = 90;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    browser.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('7px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');

    // A fractional scale close to one can remain after returning from zoom.
    viewport.scale = 1.005;
    viewport.height = 600;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('6px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');
  });

  it('waits for the updated dimensions after an orientation change', () => {
    const { browser, properties } = createBrowser();
    cleanup = initMobileViewportFix();
    browser.dispatchEvent(new Event('orientationchange'));

    browser.innerHeight = 400;
    vi.advanceTimersByTime(100);
    expect(properties.get('--vh')).toBe('4px');
  });

  it('stops all viewport updates and cancels pending orientation work on cleanup', () => {
    const viewport = createVisualViewport();
    const { browser, properties, setProperty } = createBrowser(viewport);
    cleanup = initMobileViewportFix();
    browser.dispatchEvent(new Event('orientationchange'));
    cleanup();

    const previousProperties = new Map(properties);
    setProperty.mockClear();
    viewport.height = 400;
    viewport.offsetTop = 100;
    browser.innerHeight = 500;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    browser.dispatchEvent(new Event('resize'));
    browser.dispatchEvent(new Event('pageshow'));
    browser.dispatchEvent(new Event('orientationchange'));
    vi.runAllTimers();

    expect(setProperty).not.toHaveBeenCalled();
    expect(properties).toEqual(previousProperties);
    expect(vi.getTimerCount()).toBe(0);
  });
});
