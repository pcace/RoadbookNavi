// Isolated reviewer acceptance fixture; never imported by the application.
export function isFresh(savedAt, now, maxAge) {
  return (now - savedAt) / 1000 < maxAge;
}

export function nextIndex(index, count) {
  return Math.min(index + 1, count);
}
