"use client";

import { currency } from "./format";
import { availableBalance, isExpiringSoon, roundCents, type Category } from "./planner";

export function CategorySidebar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const now = new Date();
  const rows = categories.map((category) => ({
    category,
    balance: availableBalance(category.giftCards),
    expiringSoon: category.giftCards.filter((card) => isExpiringSoon(card, now)).length,
  }));
  const total = roundCents(rows.reduce((s, row) => s + row.balance, 0));
  const expiringSoon = rows.reduce((s, row) => s + row.expiringSoon, 0);

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
          {/* Mobile: compact picker instead of the list. */}
          <label className="flex flex-col gap-1 text-sm text-subtle md:hidden">
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

          <nav aria-label="Categories" className="hidden flex-col gap-0.5 md:flex">
            <h2 className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">Categories</h2>
            {rows.map(({ category, balance, expiringSoon: soon }) => {
              const selected = category.id === selectedId;
              return (
                <a
                  key={category.id}
                  href={`?category=${category.id}`}
                  aria-current={selected ? "page" : undefined}
                  onClick={(event) => {
                    // Let modified clicks open a new tab or window as usual.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                    event.preventDefault();
                    onSelect(category.id);
                  }}
                  className={`flex min-h-12 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                    selected ? "bg-primary/15 font-semibold text-foreground" : "text-secondary hover:bg-raised"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="break-words">{category.name}</span>
                    {soon > 0 && (
                      <>
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
                        <span className="sr-only">(has a card expiring soon)</span>
                      </>
                    )}
                  </span>
                  <span className={`shrink-0 ${selected ? "text-accent" : ""}`}>{currency.format(balance)}</span>
                </a>
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );
}
