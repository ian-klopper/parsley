'use client';

import { useState } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchablePopoverProps {
  options: string[];
  onSelect: (option: string) => void;
  searchPlaceholder: string;
  trigger: React.ReactNode;
  onAddNew?: () => void;
}

export const SearchablePopover = ({ 
  options, 
  onSelect, 
  searchPlaceholder, 
  trigger, 
  onAddNew 
}: SearchablePopoverProps) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setOpen(false);
  };

  const filteredOptions = options.filter(o => 
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="searchable-popover-content p-0">
        <div className="flex flex-col">
          <div className="p-2 relative border-b-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none border-none shadow-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border-0">
            {filteredOptions.map(option => (
              <Button
                key={option}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-none border-0"
                onClick={() => handleSelect(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          {onAddNew && (
            <div className="p-2 border-0">
              <Button variant="ghost" size="sm" className="w-full border-0" onClick={onAddNew}>
                Add New
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
