import { colorSpectrum } from "@/lib/colors";
import { 
  initialMenus, 
  initialSizes, 
  initialModifierGroups 
} from "@/lib/menu-data";

const createColorMap = (items: string[], offset: number): { [name: string]: string } => {
  const colorMap: { [name: string]: string } = {};
  items.forEach((name, i) => {
    // Use pastel variant for consistency (can be light/dark theme agnostic)
    const colorObj = colorSpectrum[(i * offset) % colorSpectrum.length];
    colorMap[name] = colorObj.pastel;
  });
  return colorMap;
};

export const menuColors = createColorMap(initialMenus, 4);
export const sizeColors = createColorMap(initialSizes, 5);
export const modifierGroupColors = createColorMap(initialModifierGroups, 6);