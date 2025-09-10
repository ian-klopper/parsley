
'use client';

import { useState } from "react";
import { FoodItem } from "@/lib/food-data";
import { 
  initialMenus, 
  initialSizes, 
  initialModifierGroups, 
  initialSubcategories 
} from "@/lib/menu-data";
import { colorSpectrum } from "@/lib/colors";
import { 
  Collapsible,
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, 
  ChevronsUpDown, 
  PlusCircle, 
  Search, 
  Trash2 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const menuNames = initialMenus;
const menuColors: { [name: string]: string } = {};
menuNames.forEach((name, i) => {
  menuColors[name] = colorSpectrum[i * 4 % colorSpectrum.length];
});

const sizeNames = initialSizes;
const sizeColors: { [name: string]: string } = {};
sizeNames.forEach((name, i) => {
  sizeColors[name] = colorSpectrum[i * 5 % colorSpectrum.length];
});

const modifierGroupNames = initialModifierGroups;
const modifierGroupColors: { [name: string]: string } = {};
modifierGroupNames.forEach((name, i) => {
  modifierGroupColors[name] = colorSpectrum[i * 6 % colorSpectrum.length];
});

const AddNewPopover = ({ 
  options, 
  onAdd, 
  searchPlaceholder,
  trigger
}: { 
  options: string[], 
  onAdd: (option: string) => void, 
  searchPlaceholder: string,
  trigger: React.ReactNode
}) => {
  const [search, setSearch] = useState("");
  return (
    <Popover onOpenChange={() => setSearch("")}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col">
          <div className="p-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 focus-visible:ring-0 border-none shadow-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {options.filter(o => o.toLowerCase().includes(search.toLowerCase())).map(option => (
              <Button key={option} variant="ghost" size="sm" className="w-full justify-start rounded-none" onClick={() => onAdd(option)}>
                {option}
              </Button>
            ))}
          </div>
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full">
              Add New
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AddSizePopover = ({ onAdd, trigger }: { onAdd: (size: string, price: string) => void, trigger: React.ReactNode }) => {
  const [newSize, setNewSize] = useState<{ size: string; price: string }>({ size: "", price: "" });

  const handleAdd = () => {
    if (newSize.size && newSize.price) {
      onAdd(newSize.size, newSize.price);
      setNewSize({ size: "", price: "" });
    }
  };

  return (
    <Popover onOpenChange={() => setNewSize({ size: "", price: "" })}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-4">
          <p className="font-medium">Add Size</p>
          <div className="grid gap-2">
            <Label htmlFor="new-size">Size</Label>
            <Select onValueChange={(value) => setNewSize({ ...newSize, size: value })}>
              <SelectTrigger className="focus-visible:ring-0 shadow-none border">
                <SelectValue placeholder="Select a size" />
              </SelectTrigger>
              <SelectContent>
                {sizeNames.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-price">Price</Label>
            <Input id="new-price" value={newSize.price} onChange={(e) => setNewSize({ ...newSize, price: e.target.value })} className="focus-visible:ring-0 shadow-none border" />
          </div>
          <Button onClick={handleAdd}>Add Size</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ItemTableRow = ({
  item,
  index,
  handleItemChange,
  handleDeleteItem,
  handleAddMenu,
  handleDeleteMenu,
  handleAddSize,
  handleDeleteSize,
  handleAddModifierGroup,
  handleDeleteModifierGroup,
  setHoveredColumn
}: {
  item: FoodItem,
  index: number,
  handleItemChange: (index: number, field: string, value: any) => void,
  handleDeleteItem: (index: number) => void,
  handleAddMenu: (itemIndex: number, menu: string) => void,
  handleDeleteMenu: (itemIndex: number, menuToDelete: string) => void,
  handleAddSize: (itemIndex: number, size: string, price: string) => void,
  handleDeleteSize: (itemIndex: number, sizeToDelete: string) => void,
  handleAddModifierGroup: (itemIndex: number, group: string) => void,
  handleDeleteModifierGroup: (itemIndex: number, groupToDelete: string) => void,
  setHoveredColumn: (col: string | null) => void;
}) => {
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const menus = item.menus.split(', ').filter(Boolean);
  const modifierGroups = item.modifierGroups.split(', ').filter(Boolean);

  return (
    <TableRow className="border-b-0 hover:bg-transparent group">
      <TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn(null)} onMouseLeave={() => setHoveredColumn(null)}>
        <Input
          value={item.name}
          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
          className="font-medium border-none shadow-none focus-visible:ring-0 p-0"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-sm text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
              {item.description}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>{item.description}</p>
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="align-top w-[15%]" onMouseEnter={() => setHoveredColumn(null)} onMouseLeave={() => setHoveredColumn(null)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-[120px] max-w-[120px] justify-between p-0 font-normal border-none shadow-none focus:ring-0 focus-visible:ring-0 hover:bg-transparent">
              <span className="truncate">{item.subcategory || "Select"}</span>
              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <div className="flex flex-col gap-2">
              <div className="p-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={subcategorySearch}
                  onChange={(e) => setSubcategorySearch(e.target.value)}
                  className="h-8 pl-8 focus-visible:ring-0 border-none shadow-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {initialSubcategories.filter(s => s.toLowerCase().includes(subcategorySearch.toLowerCase())).map(subcategory => (
                  <Button key={subcategory} variant="ghost" size="sm" className="w-full justify-start rounded-none" onClick={() => handleItemChange(index, 'subcategory', subcategory)}>
                    {subcategory}
                  </Button>
                ))}
              </div>
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full">
                  Add New
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('menus')} onMouseLeave={() => setHoveredColumn(null)}>
        <div className="flex flex-wrap items-center gap-1">
          {menus.map(menu => (
            <Badge
              key={menu}
              variant="secondary"
              className="group/badge relative bg-muted text-muted-foreground menus-col"
              style={{ '--badge-color': menuColors[menu] } as React.CSSProperties}
            >
              {menu}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                <Trash2
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleDeleteMenu(index, menu)}
                />
              </div>
            </Badge>
          ))}
          <AddNewPopover
            options={menuNames}
            onAdd={(menu) => handleAddMenu(index, menu)}
            searchPlaceholder="Search menus..."
            trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
          />
        </div>
      </TableCell>
      <TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('sizes')} onMouseLeave={() => setHoveredColumn(null)}>
        <div className="flex flex-wrap items-center gap-1">
          {item.sizes.map(sizeInfo => (
            <Badge
              key={sizeInfo.size}
              variant="secondary"
              className="group/badge relative bg-muted text-muted-foreground sizes-col"
              style={{ '--badge-color': sizeColors[sizeInfo.size] } as React.CSSProperties}
            >
              {sizeInfo.size} - ${sizeInfo.price}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                <Trash2
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleDeleteSize(index, sizeInfo.size)}
                />
              </div>
            </Badge>
          ))}
          <AddSizePopover 
            onAdd={(size, price) => handleAddSize(index, size, price)}
            trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
          />
        </div>
      </TableCell>
      <TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('modifiers')} onMouseLeave={() => setHoveredColumn(null)}>
        <div className="flex flex-wrap items-center gap-1">
          {modifierGroups.map(group => (
            <Badge
              key={group}
              variant="secondary"
              className="group/badge relative bg-muted text-muted-foreground modifiers-col"
              style={{ '--badge-color': modifierGroupColors[group] } as React.CSSProperties}
            >
              {group}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                <Trash2
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleDeleteModifierGroup(index, group)}
                />
              </div>
            </Badge>
          ))}
          <AddNewPopover
            options={modifierGroupNames}
            onAdd={(group) => handleAddModifierGroup(index, group)}
            searchPlaceholder="Search groups..."
            trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
          />
        </div>
      </TableCell>
      <TableCell className="align-top w-[5%]" onMouseEnter={() => setHoveredColumn(null)} onMouseLeave={() => setHoveredColumn(null)}>
        <Trash2
          className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-destructive transition-opacity opacity-0 group-hover:opacity-100"
          onClick={() => handleDeleteItem(index)}
        />
      </TableCell>
    </TableRow>
  );
};

export const ItemTable = ({ items, onItemsChange }: { items: FoodItem[], onItemsChange: (items: FoodItem[]) => void }) => {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    onItemsChange(newItems);
  };

  const handleAddItem = (menu: string) => {
    const newItem = {
      name: "New Item",
      description: "Description",
      subcategory: items[0]?.subcategory || "Appetizers",
      menus: menu,
      sizes: [],
      modifierGroups: "",
    };
    onItemsChange([...items, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const handleAddMenu = (itemIndex: number, menu: string) => {
    const newItems = [...items];
    const currentMenus = newItems[itemIndex].menus.split(', ').filter(Boolean);
    if (!currentMenus.includes(menu)) {
      currentMenus.push(menu);
      newItems[itemIndex].menus = currentMenus.join(', ');
      onItemsChange(newItems);
    }
  };

  const handleDeleteMenu = (itemIndex: number, menuToDelete: string) => {
    const newItems = [...items];
    const currentMenus = newItems[itemIndex].menus.split(', ').filter(Boolean);
    const updatedMenus = currentMenus.filter(menu => menu !== menuToDelete).join(', ');
    newItems[itemIndex].menus = updatedMenus;
    onItemsChange(newItems);
  };

  const handleAddSize = (itemIndex: number, size: string, price: string) => {
    const newItems = [...items];
    const currentSizes = newItems[itemIndex].sizes;
    if (!currentSizes.some(s => s.size === size)) {
      currentSizes.push({ size, price });
      newItems[itemIndex].sizes = currentSizes;
      onItemsChange(newItems);
    }
  };

  const handleDeleteSize = (itemIndex: number, sizeToDelete: string) => {
    const newItems = [...items];
    const updatedSizes = newItems[itemIndex].sizes.filter(s => s.size !== sizeToDelete);
    newItems[itemIndex].sizes = updatedSizes;
    onItemsChange(newItems);
  };

  const handleAddModifierGroup = (itemIndex: number, group: string) => {
    const newItems = [...items];
    const currentGroups = newItems[itemIndex].modifierGroups.split(', ').filter(Boolean);
    if (!currentGroups.includes(group)) {
      currentGroups.push(group);
      newItems[itemIndex].modifierGroups = currentGroups.join(', ');
      onItemsChange(newItems);
    }
  };

  const handleDeleteModifierGroup = (itemIndex: number, groupToDelete: string) => {
    const newItems = [...items];
    const currentGroups = newItems[itemIndex].modifierGroups.split(', ').filter(Boolean);
    const updatedGroups = currentGroups.filter(group => group !== groupToDelete).join(', ');
    newItems[itemIndex].modifierGroups = updatedGroups;
    onItemsChange(newItems);
  };

  const groupedItems = items.reduce((acc, item) => {
    const primaryMenu = item.menus.split(', ')[0] || 'Uncategorized';
    if (!acc[primaryMenu]) {
      acc[primaryMenu] = [];
    }
    acc[primaryMenu].push(item);
    return acc;
  }, {} as Record<string, FoodItem[]>);


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
                    {menuItems.map((item) => {
                      const index = items.findIndex(i => i === item);
                      return (
                        <ItemTableRow
                          key={index}
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
                <div className="flex justify-end mt-4">
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
