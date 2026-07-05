import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

// Sortable column header (shadcn data-table pattern). Cycles asc → desc on
// click and reflects the active direction with an icon.
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>;
  }

  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("data-table-sort", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
      type="button"
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp size={14} />
      ) : sorted === "desc" ? (
        <ArrowDown size={14} />
      ) : (
        <ChevronsUpDown size={14} />
      )}
    </Button>
  );
}
