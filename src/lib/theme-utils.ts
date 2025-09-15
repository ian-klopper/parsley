import { colorSpectrum } from './colors';

export const getHashColor = (name: string, theme: string | undefined, mounted: boolean) => {
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colorObj = colorSpectrum[Math.abs(hash) % colorSpectrum.length];
  const color = mounted && theme === 'dark' ? colorObj.dark : colorObj.light;
  return { backgroundColor: color, color: mounted && theme === 'dark' ? 'white' : 'black' };
};

export const getUserColor = (user: { full_name?: string; email?: string; color_index?: number } | null | undefined, theme: string | undefined, mounted: boolean) => {
  if (!user) {
    return getHashColor('Unknown', theme, mounted);
  }

  // If user has a color_index, use it
  if (typeof user.color_index === 'number' && user.color_index >= 0 && user.color_index < colorSpectrum.length) {
    const colorObj = colorSpectrum[user.color_index];
    const color = mounted && theme === 'dark' ? colorObj.dark : colorObj.light;
    return { backgroundColor: color, color: mounted && theme === 'dark' ? 'white' : 'black' };
  }

  // Otherwise fall back to hash-based color
  return getHashColor(user.full_name || user.email || 'Unknown', theme, mounted);
};

export const getStatusStyle = (status: string, theme?: string, mounted?: boolean) => {
  const getTextColor = () => {
    return mounted && theme === 'dark' ? 'white' : 'black';
  };

  switch (status) {
    case "Complete":
    case "Success":
    case "success":
      // Green: dark theme uses dark green for white text, light theme uses light green for black text
      const successBg = mounted && theme === 'dark' ? "hsl(145, 85%, 35%)" : "hsl(145, 90%, 70%)";
      return { backgroundColor: successBg, color: getTextColor() };
    case "Processing":
      // Blue: dark theme uses dark blue for white text, light theme uses light blue for black text
      const processingBg = mounted && theme === 'dark' ? "hsl(202, 85%, 35%)" : "hsl(202, 90%, 70%)";
      return { backgroundColor: processingBg, color: getTextColor() };
    case "Error":
    case "Failure":
    case "error":
    case "failure":
      // Red: dark theme uses dark red for white text, light theme uses light red for black text
      const errorBg = mounted && theme === 'dark' ? "hsl(348, 85%, 35%)" : "hsl(348, 90%, 70%)";
      return { backgroundColor: errorBg, color: getTextColor() };
    case "Warning":
    case "warning":
      // Yellow: dark theme uses dark yellow for white text, light theme uses light yellow for black text
      const warningBg = mounted && theme === 'dark' ? "hsl(48, 85%, 35%)" : "hsl(48, 90%, 70%)";
      return { backgroundColor: warningBg, color: getTextColor() };
    default:
      return {};
  }
};

export const getStatusVariant = (status: string) => {
  switch (status) {
    case "Live":
      return "default";
    case "Processing":
      return "default";
    case "Error":
    case "Failure":
      return "destructive";
    case "Complete":
    case "Success":
      return "secondary";
    default:
      return "secondary";
  }
};