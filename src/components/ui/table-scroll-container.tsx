import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TableScrollContainerProps = {
  children: ReactNode;
  /** Default height so the table scrolls (enables sticky headers). */
  className?: string;
};

export function TableScrollContainer({ children, className }: TableScrollContainerProps) {
  // Sticky table headers need a stable vertical scroll container.
  // Using a fixed height (instead of only max-height) prevents the page itself
  // from scrolling in many layouts, which would make headers scroll away.
  return (
    <div
      className={cn(
        "min-h-0 overflow-auto h-[calc(100vh-420px)] overscroll-contain",
        className,
      )}
    >
      {children}
    </div>
  );
}
