import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function ComboBox({ options = [], value, onSelect, placeholder, searchPlaceholder, emptyText, className }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef(null);

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(option => option.value === value);

  // Filter options based on search
  const filteredOptions = safeOptions.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (optionValue) => {
    onSelect(optionValue === value ? "" : optionValue);
    setOpen(false);
    setSearchValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b border-slate-200 p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder || "Search..."}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              {emptyText || "No results found."}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-2 text-sm cursor-pointer hover:bg-slate-100",
                    value === option.value && "bg-slate-100"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}