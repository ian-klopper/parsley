'use client';

import { useState, useCallback, useEffect } from "react";
import { FoodItem } from "@/lib/food-data";

export const useItemTable = (initialItems: FoodItem[], onItemsChange: (items: FoodItem[]) => void) => {
  const [items, setItems] = useState(initialItems);

  // Sync with prop changes - critical for real-time updates
  useEffect(() => {
    console.log('🔄 useItemTable: Syncing with new initialItems:', initialItems.length);
    setItems(initialItems);
  }, [initialItems]);

  const handleItemChange = useCallback(<K extends keyof FoodItem>(index: number, field: K, value: FoodItem[K]) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleAddItem = useCallback((menu: string) => {
    const newItem: FoodItem = {
      name: "New Item",
      description: "Description",
      subcategory: items[0]?.subcategory || "Appetizers",
      menus: menu,
      sizes: [],
      modifierGroups: "",
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleDeleteItem = useCallback((index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleAddMenu = useCallback((itemIndex: number, menu: string) => {
    const newItems = [...items];
    const currentMenus = newItems[itemIndex].menus.split(', ').filter(Boolean);
    if (!currentMenus.includes(menu)) {
      newItems[itemIndex].menus = [...currentMenus, menu].join(', ');
      setItems(newItems);
      onItemsChange(newItems);
    }
  }, [items, onItemsChange]);

  const handleDeleteMenu = useCallback((itemIndex: number, menuToDelete: string) => {
    const newItems = [...items];
    newItems[itemIndex].menus = newItems[itemIndex].menus.split(', ').filter(menu => menu !== menuToDelete).join(', ');
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleAddSize = useCallback((itemIndex: number, size: string, price: string) => {
    const newItems = [...items];
    const currentSizes = newItems[itemIndex].sizes;
    if (!currentSizes.some(s => s.size === size)) {
      newItems[itemIndex].sizes = [...currentSizes, { size, price }];
      setItems(newItems);
      onItemsChange(newItems);
    }
  }, [items, onItemsChange]);

  const handleDeleteSize = useCallback((itemIndex: number, sizeToDelete: string) => {
    const newItems = [...items];
    newItems[itemIndex].sizes = newItems[itemIndex].sizes.filter(s => s.size !== sizeToDelete);
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleAddModifierGroup = useCallback((itemIndex: number, group: string) => {
    const newItems = [...items];
    const currentGroups = newItems[itemIndex].modifierGroups.split(', ').filter(Boolean);
    if (!currentGroups.includes(group)) {
      newItems[itemIndex].modifierGroups = [...currentGroups, group].join(', ');
      setItems(newItems);
      onItemsChange(newItems);
    }
  }, [items, onItemsChange]);

  const handleDeleteModifierGroup = useCallback((itemIndex: number, groupToDelete: string) => {
    const newItems = [...items];
    newItems[itemIndex].modifierGroups = newItems[itemIndex].modifierGroups.split(', ').filter(group => group !== groupToDelete).join(', ');
    setItems(newItems);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  return {
    items,
    handleAddItem,
    handleItemChange,
    handleDeleteItem,
    handleAddMenu,
    handleDeleteMenu,
    handleAddSize,
    handleDeleteSize,
    handleAddModifierGroup,
    handleDeleteModifierGroup,
  };
};
