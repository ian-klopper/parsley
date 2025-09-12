
import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useState } from "react";

export const SearchablePopover = React.memo(({
    options, onSelect, searchPlaceholder, trigger, onAddNew
}: { 
    options: string[], 
    onSelect: (option: string) => void, 
    searchPlaceholder: string, 
    trigger: React.ReactNode, 
    onAddNew?: () => void 
}) => {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    const handleSelect = (option: string) => {
        onSelect(option);
        setOpen(false);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
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
                            <Button key={option} variant="ghost" size="sm" className="w-full justify-start rounded-none" onClick={() => handleSelect(option)}>
                                {option}
                            </Button>
                        ))}
                    </div>
                    {onAddNew && (
                        <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full" onClick={onAddNew}>
                                Add New
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
});

SearchablePopover.displayName = "SearchablePopover";
