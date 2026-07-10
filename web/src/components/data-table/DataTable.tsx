import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DataTablePagination } from "./DataTablePagination";

// Generic table body for a configured TanStack table (shadcn data-table
// pattern). The caller owns columns/state/filters; this renders the grid,
// an empty state, and the pager.
export function DataTable<TData>({
  table,
  columnCount,
  empty,
}: {
  table: TanstackTable<TData>;
  columnCount: number;
  empty?: ReactNode;
}) {
  const rows = table.getRowModel().rows;
  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="archive-empty-cell" colSpan={columnCount}>
                {empty ?? "No results."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </>
  );
}
