// Exact categories that AI must use - NO DEVIATIONS ALLOWED
export const allowedCategories = [
  "Open Liquor",
  "Tequila | Mezcal",
  "Vodka",
  "Whiskey",
  "Scotch",
  "Gin",
  "Rum",
  "Liqueurs | Other",
  "Cocktails",
  "Shots",
  "Open Beer",
  "Draft Beer",
  "Bottle | Can Beer",
  "Liquor RTDs",
  "Malt RTDs",
  "Wine RTDs",
  "Open Wine",
  "Red Wine",
  "White Wine",
  "Sparkling Wine",
  "Non-Alcoholic",
  "Mocktails",
  "Merchandise",
  "Open Merchandise",
  "Open Food",
  "Appetizers",
  "Salads",
  "Entrees",
  "Sides",
  "Desserts"
];

// Exact sizes that AI must use - anything else becomes a modifier
export const allowedSizes = [
  "Single",
  "Double",
  "Neat",
  "Rocks",
  "Martini",
  "6 oz",
  "9 oz",
  "Bottle 750 mL",
  "Bottle 1 L",
  "N/A",
  "Cocktail",
  "Bottle 187.5 mL",
  "Bottle 375 mL",
  "Bottle 500 mL",
  "Bottle 1.5 L",
  "Pint",
  "Pitcher",
  "7 oz",
  "Bottle",
  "Can",
  "Bucket",
  "1.5 Dozen",
  "3 Dozen",
  "6ct",
  "12ct",
  "24ct",
  "Cup",
  "Bowl",
  "Half-Pound",
  "5 pieces",
  "5oz"
];

// Tab organization mapping categories to tabs
export const tabCategories: Record<string, string[]> = {
  "Food": ["Open Food", "Appetizers", "Salads", "Entrees", "Sides", "Desserts"],
  "Cocktails + Shots": ["Cocktails", "Shots"],
  "Liquor": ["Open Liquor", "Tequila | Mezcal", "Vodka", "Whiskey", "Scotch", "Gin", "Rum", "Liqueurs | Other"],
  "Beer + RTDs": ["Open Beer", "Draft Beer", "Bottle | Can Beer", "Liquor RTDs", "Malt RTDs", "Wine RTDs"],
  "Wine": ["Open Wine", "Red Wine", "White Wine", "Sparkling Wine"],
  "Non-Alcoholic": ["Non-Alcoholic", "Mocktails"],
  "Merchandise": ["Merchandise", "Open Merchandise"],
  "Menu Structure": [], // Special tab for menu names
  "Modifiers": [] // Special tab for modifier groups
};

// All tab names in order
export const allTabs = [
  "Food",
  "Cocktails + Shots",
  "Liquor",
  "Beer + RTDs",
  "Wine",
  "Non-Alcoholic",
  "Merchandise",
  "Menu Structure",
  "Modifiers"
];

// Legacy exports for backward compatibility
export const initialMenus = ["Brunch", "Lunch", "Dinner", "Late Night", "Happy Hour"];
export const initialSizes = allowedSizes;
export const initialModifierGroups = ["Toppings", "Sides", "Add Protein", "Crust Type", "Extra Toppings", "Sauces", "Syrups", "Milk Options"];
export const initialSubcategories = allowedCategories;
