import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface Partner {
  id: string;
  code: string;
  name: string;
  city?: string | null;
}

interface SearchablePartnerSelectProps {
  partners: Partner[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchablePartnerSelect({
  partners,
  value,
  onValueChange,
  placeholder = "Izaberite kupca...",
  disabled = false,
}: SearchablePartnerSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selectedItemRef = React.useRef<HTMLDivElement>(null);

  const selectedPartner = partners.find((p) => p.id === value);

  // Filter partners by code, name, or city
  const filteredPartners = React.useMemo(() => {
    // When opening without a search term, show a window around the currently selected partner
    // so the selected item is actually rendered (and can be scrolled into view).
    if (!search.trim()) {
      if (value) {
        const selectedIndex = partners.findIndex((p) => p.id === value);
        if (selectedIndex >= 0) {
          const start = Math.max(0, selectedIndex - 25);
          return partners.slice(start, start + 50);
        }
      }

      return partners.slice(0, 50); // Fallback: first 50 if nothing selected
    }
    
    const searchLower = search.toLowerCase();
    return partners.filter((partner) => {
      const matchCode = partner.code.toLowerCase().includes(searchLower);
      const matchName = partner.name.toLowerCase().includes(searchLower);
      const matchCity = partner.city?.toLowerCase().includes(searchLower);
      return matchCode || matchName || matchCity;
    }).slice(0, 50); // Limit to 50 results for performance
  }, [partners, search, value]);

  // Scroll to selected item when popover opens
  React.useEffect(() => {
    if (open && value && !search) {
      // Small delay to ensure the list is rendered
      const timer = setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, value, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedPartner ? (
            <span className="truncate">
              {selectedPartner.code} - {selectedPartner.name}
              {selectedPartner.city && ` (${selectedPartner.city})`}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Pretraži po šifri, nazivu ili mestu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <CommandList>
            <CommandEmpty>Nema rezultata.</CommandEmpty>
            <CommandGroup>
              {filteredPartners.map((partner) => (
                <CommandItem
                  key={partner.id}
                  value={partner.id}
                  onSelect={() => {
                    onValueChange(partner.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer"
                  ref={partner.id === value ? selectedItemRef : undefined}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === partner.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {partner.code} - {partner.name}
                    </span>
                    {partner.city && (
                      <span className="text-xs text-muted-foreground">
                        {partner.city}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
