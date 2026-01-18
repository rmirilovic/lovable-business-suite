import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Check, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Classification, ClassificationNode, buildTree, flattenTree } from "@/hooks/useClassifications";
import { getClassificationPath, formatClassificationPath } from "./ClassificationTreePicker";
import { ClassificationBadge } from "./ClassificationBadge";

interface InlineClassificationCellProps {
  value: string | null | undefined;
  classifications: Classification[];
  onSave: (code: string | null) => void;
  disabled?: boolean;
  className?: string;
  // Navigation props
  isEditing?: boolean;
  onStartEdit?: () => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
  onCancel?: () => void;
}

export function InlineClassificationCell({
  value,
  classifications,
  onSave,
  disabled = false,
  className,
  isEditing: externalIsEditing,
  onStartEdit,
  onTabNext,
  onTabPrev,
  onCancel,
}: InlineClassificationCellProps) {
  // Use external control if provided, otherwise manage internally
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsEditing !== undefined ? externalIsEditing : internalIsOpen;
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened externally
  useEffect(() => {
    if (isOpen) {
      // Expand parent nodes of selected value
      if (value) {
        const { codes } = getClassificationPath(value, classifications);
        setExpandedNodes(new Set(codes));
      }
      // Focus search input after a short delay to ensure popover is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, value, classifications]);

  // Build tree structure
  const tree = useMemo(() => buildTree(classifications), [classifications]);
  const flatList = useMemo(() => flattenTree(tree), [tree]);

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

  const setIsOpen = (open: boolean) => {
    if (externalIsEditing === undefined) {
      setInternalIsOpen(open);
    } else if (!open) {
      onCancel?.();
    }
  };

  // Expand parent nodes of selected value when opening
  const handleOpen = (open: boolean) => {
    if (open && value) {
      const { codes } = getClassificationPath(value, classifications);
      setExpandedNodes(new Set(codes));
    }
    setIsOpen(open);
    if (!open) {
      setSearchTerm("");
    }
  };

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

  const handleSelect = (code: string | null, navigateAfter?: 'next' | 'prev') => {
    if (code !== value) {
      onSave(code);
    }
    setSearchTerm("");
    
    // Handle navigation after selection
    if (navigateAfter === 'next' && onTabNext) {
      setIsOpen(false);
      onTabNext();
    } else if (navigateAfter === 'prev' && onTabPrev) {
      setIsOpen(false);
      onTabPrev();
    } else {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const direction = e.shiftKey ? 'prev' : 'next';
      // Save current value and navigate
      handleSelect(value ?? null, direction);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors",
            disabled && "cursor-default hover:bg-transparent",
            className
          )}
          onDoubleClick={() => {
            if (!disabled) {
              if (onStartEdit) {
                onStartEdit();
              } else {
                setIsOpen(true);
              }
            }
          }}
        >
          <ClassificationBadge
            code={value}
            classifications={classifications}
            className="text-sm pointer-events-none"
          />
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Pretraži..."
              className="pl-9 h-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* Tree */}
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {/* Clear option */}
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-muted-foreground",
                !value ? "bg-muted" : "hover:bg-muted"
              )}
              onClick={() => handleSelect(null)}
            >
              <X className="w-4 h-4" />
              <span className="text-sm italic">Bez klasifikacije</span>
              {!value && <Check className="w-4 h-4 ml-auto" />}
            </div>

            {filteredList.length === 0 && searchTerm ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Nema rezultata
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
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                    style={{ paddingLeft: `${node.level * 16 + 8}px` }}
                    onClick={() => handleSelect(node.code)}
                  >
                    {/* Expand/Collapse */}
                    {hasChildNodes ? (
                      <button
                        onClick={(e) => toggleExpand(node.code, e)}
                        className="p-0.5 hover:bg-muted-foreground/20 rounded shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}

                    {/* Folder icon */}
                    {hasChildNodes ? (
                      isExpanded ? (
                        <FolderOpen className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                      ) : (
                        <Folder className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                      )
                    ) : (
                      <Folder className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground/50")} />
                    )}

                    {/* Code and Name */}
                    <span className="font-mono text-xs opacity-70 shrink-0">{node.code}</span>
                    <span className="flex-1 truncate text-sm">{node.name}</span>

                    {/* Selected indicator */}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
