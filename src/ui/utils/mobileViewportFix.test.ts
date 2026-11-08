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
  const root = {
    clientHeight: 800,
    style: {
      setProperty,
      getPropertyValue: (name: string) => properties.get(name) ?? '',
      removeProperty: (name: string) => {
        const previous = properties.get(name) ?? '';
        properties.delete(name);
        return previous;
      },
    },
  };
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', {
    documentElement: root,
  });
  return { browser, root, properties, setProperty };
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
    expect(properties.get('--viewport-bottom-excluded')).toBe('100px');
    viewport.height = 600;
    viewport.dispatchEvent(new Event('resize'));
    expect(browser.innerHeight).toBe(800);
    expect(properties.get('--vh')).toBe('6px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('200px');

    viewport.height = 750;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('7.5px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('50px');
  });

  it('reserves safe-area space only when it has not already been excluded by the visual viewport', () => {
    const viewport = createVisualViewport();
    viewport.height = 800;
    const { properties } = createBrowser(viewport);
    cleanup = initMobileViewportFix();

    // Fullscreen still needs the entire device safe-area inset.
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');

    // With 20px already hidden, CSS must reserve only the remaining inset.
    viewport.height = 780;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--viewport-bottom-excluded')).toBe('20px');

    viewport.height = 820;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');
  });

  it('measures excluded browser space against the layout viewport even when innerHeight has already shrunk', () => {
    const viewport = createVisualViewport();
    const { browser, root, properties } = createBrowser(viewport);
    browser.innerHeight = 700;
    cleanup = initMobileViewportFix();

    expect(properties.get('--viewport-bottom-excluded')).toBe('100px');
    root.clientHeight = 820;
    browser.dispatchEvent(new Event('resize'));
    expect(properties.get('--viewport-bottom-excluded')).toBe('120px');
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
    expect(properties.get('--viewport-bottom-excluded')).toBe('320px');

    // Safari can move the visual viewport again after focusing an input.
    viewport.offsetTop = 220;
    viewport.dispatchEvent(new Event('scroll'));
    expect(properties.get('--viewport-offset-top')).toBe('220px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('280px');

    viewport.height = 700;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('7px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('100px');
  });

  it('falls back to window dimensions and refreshes them when a page is restored', () => {
    const { browser, root, properties } = createBrowser();
    cleanup = initMobileViewportFix();
    expect(properties.get('--vh')).toBe('8px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');

    root.clientHeight = 600;
    browser.innerHeight = 600;
    browser.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('6px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');

    // Detached or not-yet-laid-out documents fall back to innerHeight.
    root.clientHeight = 0;
    browser.innerHeight = 750;
    browser.dispatchEvent(new Event('pageshow'));
    expect(properties.get('--vh')).toBe('7.5px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');
  });

  it('lets pinch zoom magnify the app without reflowing it into the zoomed viewport', () => {
    const viewport = createVisualViewport();
    const { browser, properties } = createBrowser(viewport);
    cleanup = initMobileViewportFix();
    const beforeZoom = new Map(properties);

    viewport.scale = 2;
    viewport.height = 350;
    viewport.offsetTop = 90;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    browser.dispatchEvent(new Event('resize'));
    expect(properties).toEqual(beforeZoom);

    // A fractional scale close to one can remain after returning from zoom.
    viewport.scale = 1.005;
    viewport.height = 600;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(properties.get('--vh')).toBe('6px');
    expect(properties.get('--viewport-offset-top')).toBe('0px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('200px');
  });

  it('waits for the updated dimensions after an orientation change', () => {
    const { browser, root, properties } = createBrowser();
    cleanup = initMobileViewportFix();
    browser.dispatchEvent(new Event('orientationchange'));

    browser.innerHeight = 400;
    root.clientHeight = 400;
    vi.advanceTimersByTime(100);
    expect(properties.get('--vh')).toBe('4px');
    expect(properties.get('--viewport-bottom-excluded')).toBe('0px');
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
