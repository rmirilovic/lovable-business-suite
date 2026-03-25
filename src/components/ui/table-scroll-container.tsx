import * as React from "react";

import { cn } from "@/lib/utils";

type TableScrollContainerProps = {
  children: React.ReactNode;
  /** Additional classes - use to override default flex-grow behavior if needed */
  className?: string;
};

export const TableScrollContainer = React.forwardRef<
  HTMLDivElement,
  TableScrollContainerProps
>(({ children, className }, ref) => {
  // Sticky table headers need a stable vertical scroll container.
  // Using flex-1 allows the container to fill remaining space in flex parent,
  // while min-h-0 ensures it can shrink and overflow-auto enables scrolling.
  return (
    <div
      ref={ref}
      className={cn(
        "flex-1 min-h-0 overflow-auto overscroll-contain max-w-full",
        className,
      )}
    >
      {children}
    </div>
  );
});

TableScrollContainer.displayName = "TableScrollContainer";

export default TableScrollContainer;
