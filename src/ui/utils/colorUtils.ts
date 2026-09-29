/**
 * Generate a random hex color
 * @returns A hex color string (e.g., "#a3b2c1")
 */
export const generateRandomColor = (): string => {
  // Generate random RGB values
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);

  // Convert to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
