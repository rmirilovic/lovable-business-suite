import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Classification, ClassificationNode, buildTree, flattenTree } from "@/hooks/useClassifications";

interface ClassificationTreePickerProps {
  classifications: Classification[];
  value: string | null;
  onChange: (code: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Build the full path for a classification code
export function getClassificationPath(
  code: string | null | undefined,
  classifications: Classification[]
): { codes: string[]; names: string[] } {
  if (!code) return { codes: [], names: [] };
  
  const codes: string[] = [];
  const names: string[] = [];
  
  let currentCode: string | null = code;
  while (currentCode) {
    const classification = classifications.find(c => c.code === currentCode);
    if (classification) {
      codes.unshift(classification.code);
      names.unshift(classification.name);
      currentCode = classification.parent_code;
    } else {
      break;
    }
  }
  
  return { codes, names };
}

// Format the path as a string
export function formatClassificationPath(
  code: string | null | undefined,
  classifications: Classification[],
  options: { showCodes?: boolean; separator?: string } = {}
): string {
  const { showCodes = false, separator = " › " } = options;
  const { codes, names } = getClassificationPath(code, classifications);
  
  if (names.length === 0) return "-";
  
  if (showCodes) {
    return codes.map((c, i) => `${c} - ${names[i]}`).join(separator);
  }
  
  return names.join(separator);
}

export function ClassificationTreePicker({
  classifications,
  value,
  onChange,
  disabled = false,
  placeholder = "Izaberi klasu...",
}: ClassificationTreePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build tree structure
  const tree = useMemo(() => buildTree(classifications), [classifications]);
  const flatList = useMemo(() => flattenTree(tree), [tree]);

  // Get current value display
  const displayValue = useMemo(() => {
    if (!value) return null;
    const classification = classifications.find(c => c.code === value);
    if (!classification) return value;
    return formatClassificationPath(value, classifications, { showCodes: true });
  }, [value, classifications]);

  // Filter by search
  const filteredList = useMemo(() => {
    if (!searchTerm) return flatList;
    
    const term = searchTerm.toLowerCase();
    const matchingCodes = new Set<string>();
    
    classifications.forEach((c) => {
      if (c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)) {
        matchingCodes.add(c.code);
        // Add all ancestors
        let parentCode = c.parent_code;
        while (parentCode) {
          matchingCodes.add(parentCode);
          const parent = classifications.find((p) => p.code === parentCode);
          parentCode = parent?.parent_code || null;
        }
      }
    });

    return flatList.filter((node) => matchingCodes.has(node.code));
  }, [flatList, searchTerm, classifications]);

  // Auto-expand matching nodes when searching
  useMemo(() => {
    if (searchTerm) {
      const allCodes = filteredList.map(n => n.code);
      setExpandedNodes(new Set(allCodes));
    }
  }, [searchTerm, filteredList]);

  // Expand parent nodes of selected value
  useMemo(() => {
    if (value && !searchTerm) {
      const { codes } = getClassificationPath(value, classifications);
      setExpandedNodes(new Set(codes));
    }
  }, [value, classifications, searchTerm]);

  const toggleExpand = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const hasChildren = (code: string) => {
    return classifications.some((c) => c.parent_code === code);
  };

  const isVisible = (node: ClassificationNode) => {
    if (!node.parent_code) return true;
    let parentCode: string | null = node.parent_code;
    while (parentCode) {
      if (!expandedNodes.has(parentCode)) return false;
      const parent = classifications.find((c) => c.code === parentCode);
      parentCode = parent?.parent_code || null;
    }
    return true;
  };

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        className={cn(
          "w-full justify-between font-normal h-auto min-h-10 py-2",
          !value && "text-muted-foreground"
        )}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
      >
        <span className="text-left flex-1 whitespace-normal break-words leading-snug">
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0 self-start mt-0.5">
          {value && !disabled && (
            <X 
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Izaberi klasifikaciju</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri ili nazivu..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
            <div className="p-2">
              {filteredList.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm ? "Nema rezultata pretrage" : "Nema klasifikacija"}
                </p>
              ) : (
                filteredList.map((node) => {
                  if (!isVisible(node)) return null;
                  
                  const hasChildNodes = hasChildren(node.code);
                  const isExpanded = expandedNodes.has(node.code);
                  const isSelected = node.code === value;

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted"
                      )}
                      style={{ paddingLeft: `${node.level * 20 + 8}px` }}
                      onClick={() => handleSelect(node.code)}
                    >
                      {/* Expand/Collapse */}
                      {hasChildNodes ? (
                        <button
                          onClick={(e) => toggleExpand(node.code, e)}
                          className="p-0.5 hover:bg-muted-foreground/20 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}

                      {/* Folder icon */}
                      {hasChildNodes ? (
                        isExpanded ? (
                          <FolderOpen className={cn("w-4 h-4", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                        ) : (
                          <Folder className={cn("w-4 h-4", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                        )
                      ) : (
                        <Folder className={cn("w-4 h-4", isSelected ? "text-primary-foreground" : "text-muted-foreground/50")} />
                      )}

                      {/* Code and Name */}
                      <span className="font-mono text-xs opacity-70">{node.code}</span>
                      <span className="flex-1 truncate text-sm">{node.name}</span>

                      {/* Selected indicator */}
                      {isSelected && (
                        <Check className="w-4 h-4 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
            >
              Bez klasifikacije
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Otkaži
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
