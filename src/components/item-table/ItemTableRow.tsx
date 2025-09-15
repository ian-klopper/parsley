
import React, { useEffect, useState } from "react";
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
import { useTheme } from "next-themes";

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
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { menuColors, sizeColors, modifierGroupColors } = React.useMemo(() => {
        // Choose color variant based on theme with proper font colors
        const getColorStyle = (index: number) => {
            const colorObj = colorSpectrum[index % colorSpectrum.length];
            const bgColor = mounted && theme === 'dark' ? colorObj.dark : colorObj.light;
            const textColor = mounted && theme === 'dark' ? 'white' : 'black';

            return {
                '--hover-bg-color': bgColor,
                '--hover-text-color': textColor
            } as React.CSSProperties;
        };

        // Distribute colors evenly across the spectrum to avoid gradient effects
        const getDistributedIndex = (index: number, totalItems: number) => {
            return Math.floor((index * colorSpectrum.length) / Math.max(totalItems, 1)) % colorSpectrum.length;
        };

        const menuColors: { [name: string]: React.CSSProperties } = {};
        initialMenus.forEach((name, i) => {
            menuColors[name] = getColorStyle(getDistributedIndex(i, initialMenus.length));
        });
        menus.forEach((name, i) => {
            if (!menuColors[name]) {
                // For dynamic items, use hash-based distribution
                let hash = 0;
                for (let j = 0; j < name.length; j++) {
                    hash = ((hash << 5) - hash) + name.charCodeAt(j);
                    hash = hash & hash;
                }
                menuColors[name] = getColorStyle(Math.abs(hash) % colorSpectrum.length);
            }
        });

        const sizeColors: { [name: string]: React.CSSProperties } = {};
        initialSizes.forEach((name, i) => {
            sizeColors[name] = getColorStyle(getDistributedIndex(i, initialSizes.length));
        });
        item.sizes.forEach(({ size }, i) => {
            if (!sizeColors[size]) {
                // For dynamic items, use hash-based distribution
                let hash = 0;
                for (let j = 0; j < size.length; j++) {
                    hash = ((hash << 5) - hash) + size.charCodeAt(j);
                    hash = hash & hash;
                }
                sizeColors[size] = getColorStyle(Math.abs(hash) % colorSpectrum.length);
            }
        });

        const modifierGroupColors: { [name: string]: React.CSSProperties } = {};
        initialModifierGroups.forEach((name, i) => {
            modifierGroupColors[name] = getColorStyle(getDistributedIndex(i, initialModifierGroups.length));
        });
        modifierGroups.forEach((name, i) => {
            if (!modifierGroupColors[name]) {
                // For dynamic items, use hash-based distribution
                let hash = 0;
                for (let j = 0; j < name.length; j++) {
                    hash = ((hash << 5) - hash) + name.charCodeAt(j);
                    hash = hash & hash;
                }
                modifierGroupColors[name] = getColorStyle(Math.abs(hash) % colorSpectrum.length);
            }
        });

        return { menuColors, sizeColors, modifierGroupColors };
    }, [menus, item.sizes, modifierGroups, theme, mounted]);

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
        {menus.map((menu, menuIndex) => (
            menuIndex === menus.length - 1 ? (
                <div key={menu} className="inline-flex items-center gap-1">
                    <Badge
                        variant="secondary"
                        className="group/badge relative menus-col transition-colors"
                        style={menuColors[menu]}
                    >
                        {menu}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                            <Trash2
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => handleDeleteMenu(index, menu)}
                            />
                        </div>
                    </Badge>
                    <SearchablePopover
                        options={initialMenus}
                        onSelect={(menu) => handleAddMenu(index, menu)}
                        searchPlaceholder="Search menus..."
                        trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                        onAddNew={() => console.log('Add new menu clicked')}
                    />
                </div>
            ) : (
                <Badge
                    key={menu}
                    variant="secondary"
                    className="group/badge relative menus-col transition-colors"
                    style={menuColors[menu]}
                >
                    {menu}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                        <Trash2
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleDeleteMenu(index, menu)}
                        />
                    </div>
                </Badge>
            )
        ))}
        {menus.length === 0 && (
            <SearchablePopover
                options={initialMenus}
                onSelect={(menu) => handleAddMenu(index, menu)}
                searchPlaceholder="Search menus..."
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                onAddNew={() => console.log('Add new menu clicked')}
            />
        )}
    </div>
</TableCell>
<TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('sizes')} onMouseLeave={() => setHoveredColumn(null)}>
    <div className="flex flex-wrap items-center gap-1">
        {item.sizes.map((sizeInfo, sizeIndex) => (
            sizeIndex === item.sizes.length - 1 ? (
                <div key={sizeInfo.size} className="inline-flex items-center gap-1">
                    <Badge
                        variant="secondary"
                        className="group/badge relative sizes-col transition-colors"
                        style={sizeColors[sizeInfo.size]}
                    >
                        {sizeInfo.size} - ${sizeInfo.price}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                            <Trash2
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => handleDeleteSize(index, sizeInfo.size)}
                            />
                        </div>
                    </Badge>
                    <AddSizePopover
                        onAdd={(size, price) => handleAddSize(index, size, price)}
                        trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                    />
                </div>
            ) : (
                <Badge
                    key={sizeInfo.size}
                    variant="secondary"
                    className="group/badge relative sizes-col transition-colors"
                    style={sizeColors[sizeInfo.size]}
                >
                    {sizeInfo.size} - ${sizeInfo.price}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                        <Trash2
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleDeleteSize(index, sizeInfo.size)}
                        />
                    </div>
                </Badge>
            )
        ))}
        {item.sizes.length === 0 && (
            <AddSizePopover
                onAdd={(size, price) => handleAddSize(index, size, price)}
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
            />
        )}
    </div>
</TableCell>
<TableCell className="align-top w-[20%]" onMouseEnter={() => setHoveredColumn('modifiers')} onMouseLeave={() => setHoveredColumn(null)}>
    <div className="flex flex-wrap items-center gap-1">
        {modifierGroups.map((group, groupIndex) => (
            groupIndex === modifierGroups.length - 1 ? (
                <div key={group} className="inline-flex items-center gap-1">
                    <Badge
                        variant="secondary"
                        className="group/badge relative modifiers-col transition-colors"
                        style={modifierGroupColors[group]}
                    >
                        {group}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                            <Trash2
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => handleDeleteModifierGroup(index, group)}
                            />
                        </div>
                    </Badge>
                    <SearchablePopover
                        options={initialModifierGroups}
                        onSelect={(group) => handleAddModifierGroup(index, group)}
                        searchPlaceholder="Search groups..."
                        trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                        onAddNew={() => console.log('Add new modifier group clicked')}
                    />
                </div>
            ) : (
                <Badge
                    key={group}
                    variant="secondary"
                    className="group/badge relative modifiers-col transition-colors"
                    style={modifierGroupColors[group]}
                >
                    {group}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/badge:opacity-100 transition-opacity flex items-center justify-end pr-1 rounded-md">
                        <Trash2
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleDeleteModifierGroup(index, group)}
                        />
                    </div>
                </Badge>
            )
        ))}
        {modifierGroups.length === 0 && (
            <SearchablePopover
                options={initialModifierGroups}
                onSelect={(group) => handleAddModifierGroup(index, group)}
                searchPlaceholder="Search groups..."
                trigger={<PlusCircle className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity opacity-0 group-hover:opacity-100" />}
                onAddNew={() => console.log('Add new modifier group clicked')}
            />
        )}
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
