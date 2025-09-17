export type FoodItem = {
  name: string;
  description: string;
  subcategory: string;
  menus: string;
  sizes: { size: string; price: string }[];
  modifierGroups: string;
};

export type ModifierGroup = {
  name: string;
  options: { name: string; price: string }[];
};