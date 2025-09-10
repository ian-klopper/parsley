export const initialMenus = ["Brunch", "Lunch", "Dinner", "Late Night", "Happy Hour"];
export const initialSizes = ["Regular", "Large", "Side", '12"', '16"', "Glass", "Bottle"];
export const initialModifierGroups = ["Toppings", "Sides", "Add Protein", "Crust Type", "Extra Toppings", "Sauces", "Syrups", "Milk Options"];
export const initialSubcategories = [
  // Food
  "Appetizers", "Soups", "Salads", "Sandwiches", "Burgers", "Pizza", "Pasta", "Entrees", "Desserts", "Sides", "Kids Menu",
  // Cocktails
  "Classic Cocktails", "Signature Cocktails", "Martinis", "Margaritas", "Mojitos", "Shots",
  // Beer
  "Draft Beer", "Bottled Beer", "Canned Beer", "Cider", "RTDs (Ready-to-Drink)",
  // Wine
  "Red Wine", "White Wine", "Rosé Wine", "Sparkling Wine",
  // Liquor
  "Whiskey", "Vodka", "Gin", "Rum", "Tequila", "Liqueurs",
  // N/A
  "Coffee", "Tea", "Juice", "Soda", "Mocktails",
  // Merchandise
  "Apparel", "Glassware", "Other",
];

export const tabCategories: Record<string, string[]> = {
  "Food": ["Appetizers", "Soups", "Salads", "Sandwiches", "Burgers", "Pizza", "Pasta", "Entrees", "Desserts", "Sides", "Kids Menu"],
  "Cocktails + Shots": ["Classic Cocktails", "Signature Cocktails", "Martinis", "Margaritas", "Mojitos", "Shots"],
  "Beer + RTDs": ["Draft Beer", "Bottled Beer", "Canned Beer", "Cider", "RTDs (Ready-to-Drink)"],
  "Wine": ["Red Wine", "White Wine", "Rosé Wine", "Sparkling Wine"],
  "Liquor": ["Whiskey", "Vodka", "Gin", "Rum", "Tequila", "Liqueurs"],
  "N/A + Mocktails": ["Coffee", "Tea", "Juice", "Soda", "Mocktails"],
  "Merchandise": ["Apparel", "Glassware", "Other"],
};
