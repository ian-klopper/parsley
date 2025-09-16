interface ColorPair {
  light: string;
  dark: string;
  pastel: string;
  vibrant: string;
}

// Generate 24 colors across the full spectrum (360° / 24 = 15° steps)
// Light theme: 90% saturation, 70% lightness (light, vibrant colors for black text)
// Dark theme: Optimized saturation/lightness for vibrant colors with white text
export const colorSpectrum: ColorPair[] = Array.from({ length: 24 }, (_, i) => {
  const hue = i * 15; // 360° / 24 colors = 15° per step

  // Adjust saturation and lightness based on hue for optimal vibrancy
  // Blues and purples need slightly higher lightness for legibility
  let darkLightness = 50;
  let darkSaturation = 95;

  // Fine-tune specific color ranges for better legibility in dark mode
  if (hue >= 200 && hue <= 260) { // Blues
    darkLightness = 55;
    darkSaturation = 90;
  } else if (hue >= 260 && hue <= 290) { // Purples
    darkLightness = 52;
    darkSaturation = 85;
  } else if (hue >= 60 && hue <= 180) { // Greens and cyans
    darkLightness = 48;
    darkSaturation = 85;
  } else if (hue >= 0 && hue <= 30 || hue >= 330) { // Reds
    darkLightness = 48;
    darkSaturation = 90;
  }

  return {
    light: `hsl(${hue}, 90%, 70%)`,    // For light theme: light colors for black text
    dark: `hsl(${hue}, ${darkSaturation}%, ${darkLightness}%)`,  // For dark theme: vibrant colors for white text
    pastel: `hsl(${hue}, 90%, 70%)`,   // Update pastel mapping to match light
    vibrant: `hsl(${hue}, ${darkSaturation}%, ${darkLightness}%)`   // Update vibrant mapping to match dark
  };
});