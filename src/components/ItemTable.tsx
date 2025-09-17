'use client';

import { useState, useMemo } from "react";
import { FoodItem } from "@/lib/food-data";
import { 
  Collapsible,
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, PlusCircle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ItemTableRow } from "./item-table";
import { useItemTable } from "@/hooks/use-item-table";

export const ItemTable = ({ items: initialItems, onItemsChange }: { items: FoodItem[], onItemsChange: (items: FoodItem[]) => void }) => {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const {
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
  } = useItemTable(initialItems, onItemsChange);

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      const primaryMenu = item.menus.split(', ')[0] || 'Uncategorized';
      if (!acc[primaryMenu]) {
        acc[primaryMenu] = [];
      }
      acc[primaryMenu].push(item);
      return acc;
    }, {} as Record<string, FoodItem[]>);
  }, [items]);


  return (
    <div className="mt-0">
      <TooltipProvider>
        <div className={cn(
          "table-container",
          {
            'menus-hover': hoveredColumn === 'menus',
            'sizes-hover': hoveredColumn === 'sizes',
            'modifiers-hover': hoveredColumn === 'modifiers'
          }
        )}>
          {/* Single Table Header */}
          <div className="sticky top-0 z-20 bg-background">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0">
                  <TableHead>Item(s)</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Menu(s)</TableHead>
                  <TableHead>Size(s)</TableHead>
                  <TableHead>Modifier(s)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Collapsible Menu Sections */}
          {Object.entries(groupedItems).map(([menu, menuItems]) => (
            <Collapsible key={menu} defaultOpen={true}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 py-2 px-1">
                  <ChevronsUpDown className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">{menu} ({menuItems.length})</h3>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  <TableBody>
                    {menuItems.map((item, index) => {
                      return (
                        <ItemTableRow
                          key={item.name}
                          item={item}
                          index={index}
                          handleItemChange={handleItemChange}
                          handleDeleteItem={handleDeleteItem}
                          handleAddMenu={handleAddMenu}
                          handleDeleteMenu={handleDeleteMenu}
                          handleAddSize={handleAddSize}
                          handleDeleteSize={handleDeleteSize}
                          handleAddModifierGroup={handleAddModifierGroup}
                          handleDeleteModifierGroup={handleDeleteModifierGroup}
                          setHoveredColumn={setHoveredColumn}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-4 mb-4 px-1">
                  <Button onClick={() => handleAddItem(menu)} variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
};