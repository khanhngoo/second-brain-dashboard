import { ListFilter } from "lucide-react";
import { usePillars } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Pillar filter as an icon button + multi-select dropdown. Empty selection
// means "all pillars". The count badge surfaces how many are active.
export function PillarSwitcher() {
  const { data: pillars } = usePillars();
  const { selected, toggle, clear, isActive } = usePillarFilter();
  const count = selected.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListFilter data-icon="inline-start" />
          Pillars
          {count > 0 && <span className="filter-count">{count}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Filter by pillar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {pillars?.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.slug}
              checked={isActive(p.slug)}
              onCheckedChange={() => toggle(p.slug)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="pillar-swatch" style={{ background: p.color ?? "#888" }} />
              {p.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => clear()}>Clear filter</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
