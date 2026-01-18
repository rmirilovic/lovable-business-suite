import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Classification } from "@/hooks/useClassifications";
import { getClassificationPath } from "./ClassificationTreePicker";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ClassificationBadgeProps {
  code: string | null | undefined;
  classifications: Classification[];
  showFullPath?: boolean;
  className?: string;
}

export function ClassificationBadge({
  code,
  classifications,
  showFullPath = false,
  className,
}: ClassificationBadgeProps) {
  const { codes, names } = useMemo(
    () => getClassificationPath(code, classifications),
    [code, classifications]
  );

  if (!code || codes.length === 0) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  // Current classification (leaf)
  const currentCode = codes[codes.length - 1];
  const currentName = names[names.length - 1];

  // Full path for tooltip
  const fullPath = codes.map((c, i) => (
    <span key={c} className="inline-flex items-center">
      {i > 0 && <ChevronRight className="w-3 h-3 mx-1 text-muted-foreground" />}
      <span className="font-mono text-xs">{c}</span>
      <span className="ml-1">{names[i]}</span>
    </span>
  ));

  if (showFullPath) {
    // Show full breadcrumb path
    return (
      <div className={cn("flex flex-wrap items-center gap-0.5 text-sm", className)}>
        {codes.map((c, i) => (
          <span key={c} className="inline-flex items-center">
            {i > 0 && <ChevronRight className="w-3 h-3 mx-0.5 text-muted-foreground shrink-0" />}
            <span className={cn(
              "whitespace-nowrap",
              i === codes.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
            )}>
              {names[i]}
            </span>
          </span>
        ))}
      </div>
    );
  }

  // Show only current with tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help", className)}>
          <span className="font-mono text-xs text-muted-foreground mr-1">{currentCode}</span>
          <span>{currentName}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md">
        <div className="text-sm">
          <p className="font-medium mb-2">Puna putanja klasifikacije:</p>
          <div className="flex flex-wrap items-center gap-1">
            {fullPath}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
