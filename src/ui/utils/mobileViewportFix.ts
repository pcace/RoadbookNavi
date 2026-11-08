export function initMobileViewportFix() {
  const viewport = window.visualViewport;
  let orientationTimeout: ReturnType<typeof setTimeout> | undefined;

  const setViewportHeight = () => {
    // Pinch zoom should magnify the existing layout, not shrink the app itself.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;

    const height = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    const layoutHeight =
      document.documentElement.clientHeight || window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
    document.documentElement.style.setProperty(
      '--viewport-offset-top',
      `${offsetTop}px`
    );
    // Browser bars and the keyboard may already exclude the bottom safe area.
    document.documentElement.style.setProperty(
      '--viewport-bottom-excluded',
      `${Math.max(0, layoutHeight - offsetTop - height)}px`
    );
  };

  const onOrientationChange = () => {
    setViewportHeight();
    clearTimeout(orientationTimeout);
    // Safari can report the old dimensions until the rotation has completed.
    orientationTimeout = setTimeout(setViewportHeight, 100);
  };

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('pageshow', setViewportHeight);
  viewport?.addEventListener('resize', setViewportHeight);
  viewport?.addEventListener('scroll', setViewportHeight);

  return () => {
    clearTimeout(orientationTimeout);
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', onOrientationChange);
    window.removeEventListener('pageshow', setViewportHeight);
    viewport?.removeEventListener('resize', setViewportHeight);
    viewport?.removeEventListener('scroll', setViewportHeight);
  };
}
