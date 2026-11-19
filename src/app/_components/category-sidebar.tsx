"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useRef, useState } from "react";

import { api } from "~/trpc/react";
import { currency } from "./format";
import { availableBalance, isExpiringSoon, roundCents, type Category } from "./planner";

// Rows only move up and down.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Releasing the mouse after a drag fires a click on the dragged link. dnd-kit stops that
 * click from propagating, so the link's React onClick never runs to cancel navigation and
 * the browser would load the link's URL, reloading the page and aborting the reorder
 * request. Cancel that one click; it is dispatched before this timeout runs.
 */
function swallowDropClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
}

export function CategorySidebar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const dndId = useId();
  const listId = useId();
  const utils = api.useUtils();
  // Saves run one at a time, in drop order, so rows stay draggable while a save is in
  // flight. Each save sends the full order, so the last drop is what ends up stored.
  const pendingSaves = useRef(0);
  const reorder = api.category.reorder.useMutation({
    scope: { id: "category-reorder" },
    // After the last queued save, refetch: success confirms the order, failure restores it.
    onSettled: async () => {
      pendingSaves.current -= 1;
      if (pendingSaves.current === 0) await utils.category.getAll.invalidate();
    },
  });
  // Mobile shows a compact picker; "Reorder" reveals the list for hold-and-drag.
  const [reordering, setReordering] = useState(false);

  const sensors = useSensors(
    // Mouse: start after a small movement so ordinary clicks still select.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press and hold, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Keyboard: Space picks up and drops; Enter still opens the category.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const now = new Date();
  const rows = categories.map((category) => ({
    category,
    balance: availableBalance(category.giftCards),
    expiringSoon: category.giftCards.filter((card) => isExpiringSoon(card, now)).length,
  }));
  const total = roundCents(rows.reduce((s, row) => s + row.balance, 0));
  const expiringSoon = rows.reduce((s, row) => s + row.expiringSoon, 0);

  const ids = categories.map((category) => category.id);
  const nameOf = (id: UniqueIdentifier) => categories.find((category) => category.id === id)?.name ?? "Category";
  const positionOf = (id: UniqueIdentifier) => `position ${ids.indexOf(Number(id)) + 1} of ${ids.length}`;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    swallowDropClick();
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    // Show the new order right away; onSettled refetches the saved one.
    void utils.category.getAll.cancel();
    utils.category.getAll.setData(undefined, (old) => {
      if (!old) return old;
      const byId = new Map(old.map((category) => [category.id, category]));
      return next.flatMap((id) => byId.get(id) ?? []);
    });
    pendingSaves.current += 1;
    reorder.mutate({ ids: next });
  };

  return (
    <aside className="flex min-w-0 flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-1 rounded-xl border border-edge bg-surface p-4">
        <span className="text-xs font-medium text-subtle">All categories</span>
        <span className="text-2xl font-bold tracking-tight text-foreground">{currency.format(total)}</span>
        <span className={`text-xs ${expiringSoon > 0 ? "text-warning" : "text-subtle"}`}>
          {expiringSoon > 0
            ? `${expiringSoon} card${expiringSoon === 1 ? "" : "s"} expire${expiringSoon === 1 ? "s" : ""} within 30 days`
            : "No cards expiring within 30 days"}
        </span>
      </div>

      {categories.length > 0 && (
        <>
          {/* Mobile: compact picker, plus a button that reveals the list for reordering. */}
          <div className="flex items-end gap-2 md:hidden">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-subtle">
              Category
              <select
                value={selectedId ?? ""}
                onChange={(event) => onSelect(Number(event.target.value))}
                className="min-h-11 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-base text-foreground focus:border-primary-hover focus:outline-none"
              >
                {rows.map(({ category, balance, expiringSoon: soon }) => (
                  <option key={category.id} value={category.id}>
                    {category.name} · {currency.format(balance)}
                    {soon > 0 ? " · expiring soon" : ""}
                  </option>
                ))}
              </select>
            </label>
            {categories.length > 1 && (
              <button
                onClick={() => setReordering((value) => !value)}
                aria-expanded={reordering}
                aria-controls={listId}
                className="min-h-11 shrink-0 rounded-md border border-edge-strong px-3 py-2 text-sm font-medium text-secondary hover:bg-raised"
              >
                {reordering ? "Done" : "Reorder"}
              </button>
            )}
          </div>

          <nav
            id={listId}
            aria-label="Categories"
            className={`${reordering ? "flex" : "hidden"} flex-col gap-0.5 max-md:rounded-xl max-md:border max-md:border-edge max-md:bg-surface max-md:p-2 md:flex`}
          >
            <div className="flex items-baseline justify-between gap-2 px-3 pb-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">Categories</h2>
              {categories.length > 1 && (
                <span className="text-xs text-muted">
                  <span className="md:hidden">Hold, then drag</span>
                  <span className="max-md:hidden">Drag to reorder</span>
                </span>
              )}
            </div>
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[verticalOnly]}
              onDragEnd={onDragEnd}
              onDragCancel={swallowDropClick}
              accessibility={{
                screenReaderInstructions: {
                  draggable:
                    "To reorder, press Space, move with the arrow keys, then press Space again. Press Escape to cancel. On a touch screen, press and hold, then drag.",
                },
                announcements: {
                  onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${positionOf(active.id)}.`,
                  onDragOver: ({ active, over }) =>
                    over ? `${nameOf(active.id)} moved to ${positionOf(over.id)}.` : undefined,
                  onDragEnd: ({ active, over }) =>
                    over ? `${nameOf(active.id)} dropped at ${positionOf(over.id)}.` : `${nameOf(active.id)} dropped.`,
                  onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} returned to its place.`,
                },
              }}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-0.5">
                  {rows.map(({ category, balance, expiringSoon: soon }) => (
                    <SortableCategory
                      key={category.id}
                      id={category.id}
                      name={category.name}
                      balance={balance}
                      expiringSoon={soon > 0}
                      selected={category.id === selectedId}
                      onSelect={() => onSelect(category.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {reorder.error && <p role="alert" className="px-3 pt-2 text-sm text-danger">{reorder.error.message}</p>}
          </nav>
        </>
      )}
    </aside>
  );
}

function SortableCategory({
  id,
  name,
  balance,
  expiringSoon,
  selected,
  onSelect,
}: {
  id: number;
  name: string;
  balance: number;
  expiringSoon: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10" : undefined}
    >
      <a
        {...attributes}
        {...listeners}
        // Keep link semantics; dnd-kit's defaults would announce the row as a button.
        role={undefined}
        aria-roledescription={undefined}
        href={`?category=${id}`}
        aria-current={selected ? "page" : undefined}
        draggable={false}
        onClick={(event) => {
          // Let modified clicks open a new tab or window as usual.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onSelect();
        }}
        // A long press starts a drag on touch screens, not the link's context menu.
        onContextMenu={(event) => {
          if (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === "touch") event.preventDefault();
        }}
        className={`flex min-h-12 cursor-pointer touch-manipulation select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm [-webkit-touch-callout:none] ${
          selected ? "bg-primary/15 font-semibold text-foreground" : "text-secondary hover:bg-raised"
        } ${isDragging ? "cursor-grabbing bg-raised shadow-xl ring-1 ring-edge-strong" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="break-words">{name}</span>
          {expiringSoon && (
            <>
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
              <span className="sr-only">(has a card expiring soon)</span>
            </>
          )}
        </span>
        <span className={`shrink-0 ${selected ? "text-accent" : ""}`}>{currency.format(balance)}</span>
      </a>
    </li>
  );
}
