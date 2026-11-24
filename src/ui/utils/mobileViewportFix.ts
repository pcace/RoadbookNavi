export function initMobileViewportFix() {
  const viewport = window.visualViewport;
  let orientationTimeout: ReturnType<typeof setTimeout> | undefined;
  let settleTimeout: ReturnType<typeof setTimeout> | undefined;
  let restoreScrollOnSettle = false;

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

  const onViewportChange = () => {
    setViewportHeight();
    clearTimeout(settleTimeout);
    // iOS can finish its keyboard animation after the last viewport event.
    settleTimeout = setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditing =
        activeElement?.matches('input, textarea, select') ||
        activeElement?.isContentEditable;
      if (
        restoreScrollOnSettle &&
        !isEditing &&
        (!viewport || Math.abs(viewport.scale - 1) <= 0.01)
      ) {
        // The document is a non-scrolling shell; only its inner panels scroll.
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        restoreScrollOnSettle = false;
      }
      setViewportHeight();
    }, 350);
  };

  const onFocusChange = () => {
    restoreScrollOnSettle = true;
    onViewportChange();
  };

  const onOrientationChange = () => {
    onViewportChange();
    clearTimeout(orientationTimeout);
    // Safari can report the old dimensions until the rotation has completed.
    orientationTimeout = setTimeout(onViewportChange, 100);
  };

  setViewportHeight();
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('pageshow', onViewportChange);
  viewport?.addEventListener('resize', onViewportChange);
  viewport?.addEventListener('scroll', onViewportChange);
  document.addEventListener('focusin', onFocusChange);
  document.addEventListener('focusout', onFocusChange);

  return () => {
    clearTimeout(orientationTimeout);
    clearTimeout(settleTimeout);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onOrientationChange);
    window.removeEventListener('pageshow', onViewportChange);
    viewport?.removeEventListener('resize', onViewportChange);
    viewport?.removeEventListener('scroll', onViewportChange);
    document.removeEventListener('focusin', onFocusChange);
    document.removeEventListener('focusout', onFocusChange);
  };
}
