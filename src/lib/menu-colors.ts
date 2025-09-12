import { colorSpectrum } from "@/lib/colors";
import { 
  initialMenus, 
  initialSizes, 
  initialModifierGroups 
} from "@/lib/menu-data";

const createColorMap = (items: string[], offset: number): { [name: string]: string } => {
  const colorMap: { [name: string]: string } = {};
  items.forEach((name, i) => {
    colorMap[name] = colorSpectrum[(i * offset) % colorSpectrum.length];
  });
  return colorMap;
};

export const menuColors = createColorMap(initialMenus, 4);
export const sizeColors = createColorMap(initialSizes, 5);
export const modifierGroupColors = createColorMap(initialModifierGroups, 6);