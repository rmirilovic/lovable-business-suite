import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TableScrollContainerProps = {
  children: ReactNode;
  /** Default height so the table scrolls (enables sticky headers). */
  className?: string;
};

export function TableScrollContainer({ children, className }: TableScrollContainerProps) {
  return <div className={cn("overflow-auto max-h-[calc(100vh-320px)]", className)}>{children}</div>;
}
