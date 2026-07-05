import type { Table } from "@tanstack/react-table";
import { Button } from "../ui/button";

// Previous/next pager for a TanStack table (shadcn data-table pattern).
export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  return (
    <div className="data-table-pagination">
      <span>
        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
      </span>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          type="button"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          type="button"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
