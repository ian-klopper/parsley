
import React from "react";
import { FoodItem } from "@/lib/food-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, PlusCircle, Trash2 } from "lucide-react";
import { SearchablePopover } from "./SearchablePopover";
import { AddSizePopover } from "./AddSizePopover";
import { initialSubcategories } from "@/lib/menu-data";
import { colorSpectrum } from "@/lib/colors";
import { initialMenus, initialModifierGroups, initialSizes } from "@/lib/menu-data";

export const ItemTableRow = React.memo(({
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
    handleItemChange: <K extends keyof FoodItem>(index: number, field: K, value: FoodItem[K]) => void,
    handleDeleteItem: (index: number) => void,
    handleAddMenu: (itemIndex: number, menu: string) => void,
    handleDeleteMenu: (itemIndex: number, menuToDelete: string) => void,
    handleAddSize: (itemIndex: number, size: string, price: string) => void,
    handleDeleteSize: (itemIndex: number, sizeToDelete: string) => void,
    handleAddModifierGroup: (itemIndex: number, group: string) => void,
    handleDeleteModifierGroup: (itemIndex: number, groupToDelete: string) => void,
    setHoveredColumn: (col: string | null) => void;
}) => {
    const menus = item.menus.split(', ').filter(Boolean);
    const modifierGroups = item.modifierGroups.split(', ').filter(Boolean);

    const { menuColors, sizeColors, modifierGroupColors } = React.useMemo(() => {
        const menuColors: { [name: string]: string } = {};
        initialMenus.forEach((name, i) => {
            menuColors[name] = colorSpectrum[i % colorSpectrum.length];
        });
        menus.forEach(name => {
            if (!menuColors[name]) {
                menuColors[name] = colorSpectrum[Math.floor(Math.random() * colorSpectrum.length)];
            }
        });

        const sizeColors: { [name: string]: string } = {};
        initialSizes.forEach((name, i) => {
            sizeColors[name] = colorSpectrum[i % colorSpectrum.length];
        });
        item.sizes.forEach(({ size }) => {
            if (!sizeColors[size]) {
                sizeColors[size] = colorSpectrum[Math.floor(Math.random() * colorSpectrum.length)];
            }
        });

        const modifierGroupColors: { [name: string]: string } = {};
        initialModifierGroups.forEach((name, i) => {
            modifierGroupColors[name] = colorSpectrum[i % colorSpectrum.length];
        });
        modifierGroups.forEach(name => {
            if (!modifierGroupColors[name]) {
                modifierGroupColors[name] = colorSpectrum[Math.floor(Math.random() * colorSpectrum.length)];
            }
        });

        return { menuColors, sizeColors, modifierGroupColors };
    }, [menus, item.sizes, modifierGroups]);

    return (
        <TableRow className="border-b-0 group">
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
                <SearchablePopover
                    options={initialSubcategories}
                    onSelect={(subcategory) => handleItemChange(index, 'subcategory', subcategory)}
                    searchPlaceholder="Search..."
                    trigger={(
                        <Button variant="ghost" className="w-[120px] max-w-[120px] justify-between p-0 font-normal border-none shadow-none focus:ring-0 focus-visible:ring-0 hover:bg-transparent">
                            <span className="truncate">{item.subcategory || "Select"}</span>
                            <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                        </Button>
                    )}
                />
            </TableCell>
            <TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('menus')} onMouseLeave={() => setHoveredColumn(null)}>
    <div className="flex flex-wrap items-center gap-1">
        {menus.map((menu, i) => (
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
        <div className="inline-flex items-center">
            <SearchablePopover
                options={initialMenus}
                onSelect={(menu) => handleAddMenu(index, menu)}
                searchPlaceholder="Search menus..."
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                onAddNew={() => console.log('Add new menu clicked')}
            />
        </div>
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
        <div className="inline-flex items-center">
            <AddSizePopover
                onAdd={(size, price) => handleAddSize(index, size, price)}
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
            />
        </div>
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
        <div className="inline-flex items-center">
            <SearchablePopover
                options={initialModifierGroups}
                onSelect={(group) => handleAddModifierGroup(index, group)}
                searchPlaceholder="Search groups..."
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                onAddNew={() => console.log('Add new modifier group clicked')}
            />
        </div>
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
});

ItemTableRow.displayName = "ItemTableRow";
