import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { addSubtask, toggleSubtask } from "../api/client";
import { useTask, useInvalidateAll } from "../hooks/queries";
import { Checkbox } from "./ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

// Collapsible subtask panel reused by TaskCard and MilestonesView. The task
// detail (which carries subtasks) is fetched lazily — only once expanded — so
// list views stay light. Mutations broadly invalidate (single-user app).
export function SubtaskList({
  taskId,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
}: {
  taskId: number;
  defaultOpen?: boolean;
  // When `open`/`onOpenChange` are supplied the panel is controlled (TaskCard
  // drives it so it can force-collapse a done task); otherwise self-managed.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const { data: detail } = useTask(taskId, open);
  const invalidate = useInvalidateAll();

  const total = detail?.subtasks.length ?? 0;
  const done = detail?.subtasks.filter((s) => s.done).length ?? 0;

  const toggle = useMutation({ mutationFn: toggleSubtask, onSuccess: invalidate });
  const add = useMutation({
    mutationFn: (value: string) => addSubtask(taskId, value),
    onSuccess: () => {
      setSubtaskTitle("");
      invalidate();
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="subtask-collapsible">
      <CollapsibleTrigger className="subtask-trigger">
        <ChevronRight size={14} className={open ? "chev open" : "chev"} />
        <span>{total > 0 ? `${done}/${total} subtasks` : "Subtasks"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="subtask-content">
        <div className="subtask-list">
          {detail?.subtasks.map((s) => (
            <label key={s.id} className="subtask-row">
              <Checkbox
                checked={Boolean(s.done)}
                onCheckedChange={() => toggle.mutate(s.id)}
              />
              <span className={s.done ? "subtask-done" : ""}>{s.title}</span>
            </label>
          ))}
          {detail && total === 0 && <p className="empty subtle">No subtasks yet.</p>}
        </div>
        <form
          className="subtask-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (subtaskTitle.trim()) add.mutate(subtaskTitle.trim());
          }}
        >
          <input
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            placeholder="Add subtask"
            aria-label="New subtask"
          />
          <button
            className="icon-btn"
            type="submit"
            disabled={!subtaskTitle.trim() || add.isPending}
            aria-label="Add subtask"
          >
            <Plus size={15} />
          </button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
