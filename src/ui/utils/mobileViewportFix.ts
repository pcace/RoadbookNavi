/**
 * Mobile Viewport Height Fix
 *
 * This utility helps fix the issue with 100vh not working properly on mobile browsers
 * by setting a CSS variable (--vh) that represents 1% of the actual viewport height.
 */

export function initMobileViewportFix() {
  // Initial setup
  setViewportHeight();

  // Update on resize
  window.addEventListener('resize', setViewportHeight);

  // Update on orientation change
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure dimensions are updated after orientation change
    setTimeout(setViewportHeight, 100);
  });
}

function setViewportHeight() {
  // Get the actual viewport height
  const vh = window.innerHeight * 0.01;

  // Set the --vh custom property to the root of the document
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
