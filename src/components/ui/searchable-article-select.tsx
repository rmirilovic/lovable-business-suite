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
import { formatDecimal } from "@/lib/formatting";

export interface Article {
  id: string;
  code: string;
  name: string;
  article_group?: string | null;
  unit: string;
  selling_price?: number | null;
  is_active?: boolean | null;
}

interface SearchableArticleSelectProps {
  articles: Article[];
  value: string;
  onValueChange: (articleId: string, article: Article) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableArticleSelect({
  articles,
  value,
  onValueChange,
  placeholder = "Izaberite artikal...",
  disabled = false,
}: SearchableArticleSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedArticle = articles.find((a) => a.id === value);

  // Filter articles by code, name, or group - with memoization for performance
  const filteredArticles = React.useMemo(() => {
    const activeArticles = articles.filter(a => a.is_active !== false);
    
    if (!search.trim()) return activeArticles.slice(0, 50); // Show first 50 if no search
    
    const searchLower = search.toLowerCase();
    return activeArticles.filter((article) => {
      const matchCode = article.code.toLowerCase().includes(searchLower);
      const matchName = article.name.toLowerCase().includes(searchLower);
      const matchGroup = article.article_group?.toLowerCase().includes(searchLower);
      return matchCode || matchName || matchGroup;
    }).slice(0, 50); // Limit to 50 results for performance
  }, [articles, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-8 text-left"
          disabled={disabled}
        >
          {selectedArticle ? (
            <span className="truncate">
              {selectedArticle.code} - {selectedArticle.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Pretraži po šifri, nazivu ili klasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <CommandList>
            <CommandEmpty>Nema rezultata.</CommandEmpty>
            <CommandGroup>
              {filteredArticles.map((article) => (
                <CommandItem
                  key={article.id}
                  value={article.id}
                  onSelect={() => {
                    onValueChange(article.id, article);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === article.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">
                      {article.code} - {article.name}
                    </span>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{article.unit}</span>
                      {article.selling_price != null && (
                        <span>{formatDecimal(article.selling_price)} RSD</span>
                      )}
                    </div>
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
