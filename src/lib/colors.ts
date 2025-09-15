interface ColorPair {
  light: string;
  dark: string;
  pastel: string;
  vibrant: string;
}

// Generate 64 colors across the full spectrum (360° / 64 = 5.625° steps)
// Light theme: 90% saturation, 70% lightness (light, vibrant colors for black text)
// Dark theme: 85% saturation, 35% lightness (dark, rich colors for white text)
export const colorSpectrum: ColorPair[] = Array.from({ length: 64 }, (_, i) => {
  const hue = i * 5.625; // 360° / 64 colors = 5.625° per step
  return {
    light: `hsl(${hue}, 90%, 70%)`,    // For light theme: light colors for black text
    dark: `hsl(${hue}, 85%, 35%)`,     // For dark theme: dark colors for white text
    pastel: `hsl(${hue}, 90%, 70%)`,   // Update pastel mapping to match light
    vibrant: `hsl(${hue}, 85%, 35%)`   // Update vibrant mapping to match dark
  };
});