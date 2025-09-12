
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialSizes } from "@/lib/menu-data";

const sizeNames = initialSizes;

import { useState } from "react";

export const AddSizePopover = React.memo(({
    onAdd, trigger
}: { 
    onAdd: (size: string, price: string) => void, 
    trigger: React.ReactNode 
}) => {
    const [open, setOpen] = useState(false);
    const [newSize, setNewSize] = useState<{ size: string; price: string }>({ size: "", price: "" });

    const handleAdd = () => {
        if (newSize.size && newSize.price) {
            onAdd(newSize.size, newSize.price);
            setNewSize({ size: "", price: "" });
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
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
});

AddSizePopover.displayName = "AddSizePopover";
