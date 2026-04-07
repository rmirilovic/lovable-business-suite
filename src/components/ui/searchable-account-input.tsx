import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Account {
  code: string;
  name: string;
}

interface SearchableAccountInputProps {
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
  disabled?: boolean;
  placeholder?: string;
}

export function SearchableAccountInput({
  value,
  onChange,
  accounts,
  disabled = false,
  placeholder = "Šifra konta",
}: SearchableAccountInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  const filtered = accounts.filter(
    (a) =>
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 30);

  const selectedAccount = accounts.find((a) => a.code === value);

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className={cn("pr-2", selectedAccount && "font-medium")}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[320px]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-[200px]">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground text-center">Nema rezultata</div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.code}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex gap-2",
                  a.code === value && "bg-accent font-medium"
                )}
                onClick={() => {
                  onChange(a.code);
                  setSearch(a.code);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-xs shrink-0 w-12">{a.code}</span>
                <span className="truncate text-muted-foreground">{a.name}</span>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
