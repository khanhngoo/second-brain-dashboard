import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Archive, ArrowUpDown, CalendarCheck2, Columns3, Eye, TimerReset } from "lucide-react";
import type { ArchivedTask } from "../api/types";
import { formatDuration } from "../components/DurationInput";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useArchivedTasks, usePillars } from "../hooks/queries";
import { ALL, usePillarFilter } from "../state/pillarFilter";
import { useTaskDrawer } from "../state/taskDrawer";

const ALL_VALUE = "__all";

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "No date";
}

function completedStart(value: string) {
  return value ? `${value}T00:00:00+00:00` : undefined;
}

function completedEnd(value: string) {
  return value ? `${value}T23:59:59+00:00` : undefined;
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button className="archive-sort-btn" variant="ghost" size="sm" onClick={onClick} type="button">
      {label}
      <ArrowUpDown size={14} />
    </Button>
  );
}

export function ArchiveView() {
  const { data: pillars } = usePillars();
  const { pillar, apiPillar, setPillar } = usePillarFilter();
  const { openTaskDrawer } = useTaskDrawer();
  const [completedFrom, setCompletedFrom] = useState("");
  const [completedTo, setCompletedTo] = useState("");
  const [query, setQuery] = useState("");
  const [milestone, setMilestone] = useState(ALL_VALUE);
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "completed_at", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    due_date: false,
    estimated_duration_min: false,
  });

  const { data, isLoading } = useArchivedTasks({
    pillar: apiPillar,
    completed_from: completedStart(completedFrom),
    completed_to: completedEnd(completedTo),
  });

  const milestones = useMemo(() => {
    const titles = new Set<string>();
    for (const task of data ?? []) {
      if (task.milestone_title) titles.add(task.milestone_title);
    }
    return [...titles].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minDuration.trim() ? Number(minDuration) : null;
    const max = maxDuration.trim() ? Number(maxDuration) : null;
    return (data ?? []).filter((task) => {
      if (q) {
        const haystack = [
          task.title,
          task.description,
          task.pillar_name,
          task.milestone_title,
          task.note_ref,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (milestone !== ALL_VALUE && task.milestone_title !== milestone) return false;
      if (min != null && Number.isFinite(min) && task.actual_duration_min < min) return false;
      if (max != null && Number.isFinite(max) && task.actual_duration_min > max) return false;
      return true;
    });
  }, [data, maxDuration, milestone, minDuration, query]);

  const totalMinutes = filtered.reduce((sum, task) => sum + task.actual_duration_min, 0);

  const columns = useMemo<ColumnDef<ArchivedTask>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortButton label="Task" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="archive-task-cell">
              <button type="button" onClick={() => openTaskDrawer({ taskId: task.id })}>
                {task.title}
              </button>
              <span>{task.description || task.note_ref || "No note attached"}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "pillar_name",
        header: ({ column }) => (
          <SortButton label="Pillar" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => (
          <Badge className="archive-pillar-badge" variant="outline">
            <span className="dot" style={{ background: row.original.pillar_color ?? "#888" }} />
            {row.original.pillar_name}
          </Badge>
        ),
      },
      {
        accessorKey: "milestone_title",
        header: "Milestone",
        cell: ({ row }) => row.original.milestone_title ?? <span className="muted">None</span>,
      },
      {
        accessorKey: "completed_at",
        header: ({ column }) => (
          <SortButton label="Completed" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => dateOnly(row.original.completed_at),
      },
      {
        accessorKey: "actual_duration_min",
        header: ({ column }) => (
          <SortButton label="Actual" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => formatDuration(row.original.actual_duration_min),
      },
      {
        accessorKey: "estimated_duration_min",
        header: "Estimate",
        cell: ({ row }) =>
          row.original.estimated_duration_min != null
            ? formatDuration(row.original.estimated_duration_min)
            : <span className="muted">None</span>,
      },
      {
        accessorKey: "due_date",
        header: "Due",
        cell: ({ row }) => dateOnly(row.original.due_date),
      },
      {
        id: "flags",
        header: "Flags",
        cell: ({ row }) => {
          const flags = [
            row.original.is_urgent ? "Urgent" : null,
            row.original.is_important ? "Important" : null,
          ].filter(Boolean);
          return flags.length ? flags.join(" + ") : <span className="muted">None</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            aria-label={`Open ${row.original.title}`}
            className="archive-row-action"
            variant="outline"
            size="icon"
            onClick={() => openTaskDrawer({ taskId: row.original.id })}
            type="button"
          >
            <Eye size={15} />
          </Button>
        ),
      },
    ],
    [openTaskDrawer],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="view-stack archive-view">
      <div className="view-heading split">
        <div>
          <p className="eyebrow">Completion history</p>
          <h2 className="view-title">Archived Tasks</h2>
        </div>
        <div className="archive-summary" aria-label="Archive summary">
          <span>
            <Archive size={15} />
            {filtered.length} done
          </span>
          <span>
            <TimerReset size={15} />
            {formatDuration(totalMinutes)}
          </span>
        </div>
      </div>

      <section className="archive-toolbar" aria-label="Archive filters">
        <label className="archive-filter wide">
          <span>Search</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Task, note, pillar..."
          />
        </label>
        <label className="archive-filter">
          <span>Pillar</span>
          <Select value={pillar === ALL ? ALL_VALUE : pillar} onValueChange={(value) => setPillar(value === ALL_VALUE ? ALL : value)}>
            <SelectTrigger>
              <SelectValue placeholder="All pillars" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All pillars</SelectItem>
              {pillars?.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="archive-filter">
          <span>Milestone</span>
          <Select value={milestone} onValueChange={setMilestone}>
            <SelectTrigger>
              <SelectValue placeholder="All milestones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All milestones</SelectItem>
              {milestones.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="archive-filter">
          <span>Completed from</span>
          <Input type="date" value={completedFrom} onChange={(event) => setCompletedFrom(event.target.value)} />
        </label>
        <label className="archive-filter">
          <span>Completed to</span>
          <Input type="date" value={completedTo} onChange={(event) => setCompletedTo(event.target.value)} />
        </label>
        <label className="archive-filter compact">
          <span>Min min</span>
          <Input inputMode="numeric" value={minDuration} onChange={(event) => setMinDuration(event.target.value)} />
        </label>
        <label className="archive-filter compact">
          <span>Max min</span>
          <Input inputMode="numeric" value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)} />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="archive-columns" variant="outline" type="button">
              <Columns3 size={15} />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                >
                  {column.id.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <section className="archive-table-shell">
        {isLoading ? (
          <p className="muted">Loading archived tasks...</p>
        ) : (
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
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
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
                    <TableCell className="archive-empty-cell" colSpan={columns.length}>
                      <CalendarCheck2 size={18} />
                      No finished tasks match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="archive-pagination">
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
          </>
        )}
      </section>
    </div>
  );
}
