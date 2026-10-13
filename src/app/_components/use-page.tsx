"use client";

import { useEffect, useRef, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { currency, dateFormat } from "./format";
import { CardModal } from "./card-modal";
import { CategoryForm } from "./category-form";

type Category = RouterOutputs["category"]["getAll"][number];
type GiftCard = Category["giftCards"][number];

const SORT_OPTIONS = {
  "expiry-soonest": "Soonest expiry",
  "value-highest": "Highest value",
  "value-lowest": "Lowest value",
  oldest: "Oldest first",
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const SORT_STORAGE_PREFIX = "giftcard-category-sort";

function sortCards(cards: GiftCard[], sort: SortKey): GiftCard[] {
  const sorted = [...cards];
  switch (sort) {
    case "expiry-soonest":
      sorted.sort((a, b) => {
        if (a.expiresAt === null && b.expiresAt === null)
          return a.createdAt.getTime() - b.createdAt.getTime();
        if (a.expiresAt === null) return 1;
        if (b.expiresAt === null) return -1;
        return a.expiresAt.getTime() - b.expiresAt.getTime();
      });
      break;
    case "value-highest":
      sorted.sort((a, b) => b.balance - a.balance);
      break;
    case "value-lowest":
      sorted.sort((a, b) => a.balance - b.balance);
      break;
    case "oldest":
      sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
  }
  return sorted;
}

const roundCents = (n: number) => Math.round(n * 100) / 100;

export function UsePage() {
  const [categories] = api.category.getAll.useSuspenseQuery();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [modal, setModal] = useState<{
    card: GiftCard | null;
    categoryId: number;
  } | null>(null);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <header className="mx-auto mb-6 flex w-full max-w-md flex-col items-center gap-4 text-center md:mb-8 md:max-w-none md:flex-row md:flex-wrap md:justify-between md:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Your Gift Cards</h1>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-3 md:w-auto md:justify-end">
          <button
            onClick={() => setCreatingCategory((value) => !value)}
            aria-expanded={creatingCategory}
            aria-controls="new-category-form"
            className="min-h-11 rounded-md border border-edge-strong px-3 py-2 text-sm font-medium text-secondary hover:bg-raised"
          >
            New category
          </button>
          <button
            onClick={() => {
              const firstCategory = categories[0];
              if (firstCategory) setModal({ card: null, categoryId: firstCategory.id });
            }}
            disabled={categories.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            Add card
          </button>
        </div>
      </header>

      {creatingCategory && (
        <div id="new-category-form" className="mx-auto mb-6 w-full max-w-md rounded-xl border border-edge bg-raised/60 p-5 md:mx-0">
          <CategoryForm onClose={() => setCreatingCategory(false)} />
        </div>
      )}

      <div className="flex justify-center">
        {categories.length === 0 ? (
          <div className="w-full max-w-md rounded-xl border border-dashed border-edge px-6 py-12 text-center text-subtle md:max-w-none md:py-20">
            No categories yet. Choose “New category” above to get started,
            then add your first gift card.
          </div>
        ) : (
          <div className="grid w-full max-w-md grid-cols-1 items-start gap-5 md:max-w-none md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {categories.map((category) => (
              <CategoryPlanner
                key={category.id}
                category={category}
                onAddCard={() => setModal({ card: null, categoryId: category.id })}
                onEditCard={(card) => setModal({ card, categoryId: category.id })}
              />
            ))}
          </div>
        )}
      </div>
      {modal && (
        <CardModal
          categories={categories}
          card={modal.card}
          defaultCategoryId={modal.categoryId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CategoryPlanner({
  category,
  onAddCard,
  onEditCard,
}: {
  category: Category;
  onAddCard: () => void;
  onEditCard: (card: GiftCard) => void;
}) {
  const utils = api.useUtils();
  const [sort, setSort] = useState<SortKey>("expiry-soonest");
  const sortStorageKey = `${SORT_STORAGE_PREFIX}:${category.id}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(sortStorageKey);
      setSort(
        saved && Object.prototype.hasOwnProperty.call(SORT_OPTIONS, saved)
          ? (saved as SortKey)
          : "expiry-soonest",
      );
    } catch {
      // Sorting remains usable when browser storage is unavailable.
      setSort("expiry-soonest");
    }
  }, [sortStorageKey]);

  const changeSort = (value: SortKey) => {
    setSort(value);
    try {
      localStorage.setItem(sortStorageKey, value);
    } catch {
      // Keep the selection for this visit even if it cannot be persisted.
    }
  };

  const [amountStr, setAmountStr] = useState("");
  const [isSpending, setIsSpending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => utils.category.getAll.invalidate(),
  });
  const busy = isSpending || deleteCategory.isPending;

  const deductFromCard = api.giftCard.deduct.useMutation();

  const funded = sortCards(
    category.giftCards.filter((g) => g.balance > 0),
    sort,
  );
  const total = roundCents(funded.reduce((s, g) => s + g.balance, 0));

  const amount = Number.parseFloat(amountStr);
  const validAmount = !Number.isNaN(amount) && amount > 0;

  // Pick cards in sort order until the planned amount is covered.
  const selection: { card: GiftCard; portion: number }[] = [];
  if (validAmount) {
    let remaining = amount;
    for (const card of funded) {
      if (remaining <= 0) break;
      const portion = roundCents(Math.min(card.balance, remaining));
      selection.push({ card, portion });
      remaining = roundCents(remaining - portion);
    }
  }
  const covered = roundCents(selection.reduce((s, x) => s + x.portion, 0));
  const shortfall = validAmount ? roundCents(amount - covered) : 0;

  const markUsed = async () => {
    setIsSpending(true);
    try {
      for (const { card, portion } of selection) {
        await deductFromCard.mutateAsync({ id: card.id, amount: portion });
      }
      setAmountStr("");
    } catch {
      // The mutation error is displayed below; refresh any completed deductions.
    } finally {
      setIsSpending(false);
      await utils.category.getAll.invalidate();
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-4 rounded-xl border border-edge bg-raised/60 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <h2 className="min-w-0 flex-1 break-words text-lg font-semibold text-foreground">{category.name}</h2>
            <details
              ref={menuRef}
              className="relative shrink-0"
              onKeyDown={(event) => {
                if (event.key === "Escape" && menuRef.current) {
                  menuRef.current.open = false;
                  menuRef.current.querySelector("summary")?.focus();
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
              }}
            >
              <summary aria-label={`Actions for ${category.name}`} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md text-subtle hover:bg-edge hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true">•••</span>
              </summary>
              <div className="absolute left-0 top-full z-10 w-40 rounded-lg border border-edge bg-raised p-1 shadow-xl">
                <button disabled={busy} onClick={() => { if (menuRef.current) menuRef.current.open = false; onAddCard(); }} className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-secondary hover:bg-edge disabled:opacity-50">Add card</button>
                <button disabled={busy} onClick={() => { if (menuRef.current) menuRef.current.open = false; setRenaming(true); }} className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-secondary hover:bg-edge disabled:opacity-50">Rename category</button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (menuRef.current) menuRef.current.open = false;
                    if (confirm(`Delete "${category.name}" and all ${category.giftCards.length} of its cards? This cannot be undone.`)) {
                      deleteCategory.mutate({ id: category.id });
                    }
                  }}
                  className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-danger hover:bg-danger-fill/10 disabled:opacity-50"
                >
                  Delete category
                </button>
              </div>
            </details>
          </div>
          <p className="mt-0.5 text-sm text-subtle">
            {funded.length} card{funded.length === 1 ? "" : "s"} available
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-2xl font-bold text-accent">
            {currency.format(total)}
          </span>
          <button
            disabled={category.giftCards.length === 0}
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="text-xs text-subtle hover:text-foreground"
          >
            {showAll ? "Hide cards" : "Show all cards"}
          </button>
        </div>
      </div>

      {renaming && <CategoryForm category={category} onClose={() => setRenaming(false)} />}
      {deleteCategory.error && <p role="alert" className="text-sm text-danger">{deleteCategory.error.message}</p>}
      {deductFromCard.error && <p role="alert" className="text-sm text-danger">{deductFromCard.error.message}</p>}

      {showAll && (
        <div className="flex flex-col gap-3">
          <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-subtle">
            Sort by
            <select
              aria-label={`Sort cards in ${category.name}`}
              value={sort}
              disabled={busy}
              onChange={(event) => changeSort(event.target.value as SortKey)}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-edge-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary-hover focus:outline-none disabled:opacity-50"
            >
              {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {sortCards(category.giftCards, sort).map((card) => (
            <PlannedCard key={card.id} card={card} onEdit={() => onEditCard(card)} disabled={busy} />
          ))}
        </div>
      )}

      {category.giftCards.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-sm text-subtle">
          <p>No cards in this category yet.</p>
          <button disabled={busy} onClick={onAddCard} className="min-h-11 rounded-md px-3 py-2 text-accent hover:bg-edge disabled:opacity-50">+ Add card</button>
        </div>
      ) : funded.length === 0 ? (
        <p className="text-sm text-muted">
          All used up — no cards with a balance left.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm text-subtle">
            Order Total
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountStr}
              disabled={busy}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 20"
              className="min-w-0 w-full rounded-md border border-edge bg-surface px-3 py-2 text-base text-foreground [appearance:textfield] placeholder:text-muted focus:border-primary-hover focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>

          {validAmount && (
            <>
              <div className="flex flex-col gap-3">
                {selection.map(({ card, portion }) => (
                  <PlannedCard key={card.id} card={card} portion={portion} />
                ))}
              </div>

              {shortfall > 0 && (
                <p className="text-sm font-medium text-danger">
                  {currency.format(shortfall)} short — this category only has{" "}
                  {currency.format(total)}.
                </p>
              )}

              <button
                onClick={markUsed}
                disabled={busy || selection.length === 0}
                className="rounded-md bg-warning-fill/20 px-4 py-2 text-sm font-medium text-warning hover:bg-warning-fill/30 disabled:opacity-50"
              >
                {isSpending
                  ? "…"
                  : `Used ${currency.format(covered)} across ${selection.length} card${selection.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PlannedCard({ card, portion, onEdit, disabled = false }: {
  card: GiftCard;
  portion?: number;
  onEdit?: () => void;
  disabled?: boolean;
}) {
  const utils = api.useUtils();
  const deleteCard = api.giftCard.delete.useMutation({
    onSuccess: () => utils.category.getAll.invalidate(),
  });
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const expired = card.expiresAt !== null && card.expiresAt < new Date();

  const copyCode = async () => {
    await navigator.clipboard.writeText(card.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-edge bg-surface/70 p-4">
      <div className="flex flex-nowrap">
        {portion !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-bold text-warning">
            Use {currency.format(portion)}
          </span>
          <span className="text-sm text-subtle">
            of {currency.format(card.balance)}
          </span>
        </div>
      ) : (
        <span
          className={`text-lg font-bold ${
            card.balance > 0 ? "text-accent" : "text-muted"
          }`}
        >
          {currency.format(card.balance)}
        </span>
      )}
      <div className="flex-grow"></div>
      {onEdit && (
        <div className="flex flex-wrap justify-end gap-1">
          <button disabled={disabled || deleteCard.isPending} onClick={onEdit} className="min-h-11 rounded-md px-3 py-2 text-xs text-secondary hover:bg-edge disabled:opacity-50">Edit</button>
          <button
            disabled={disabled || deleteCard.isPending}
            onClick={() => {
              if (confirm("Delete this gift card? This cannot be undone.")) deleteCard.mutate({ id: card.id });
            }}
            className="min-h-11 rounded-md px-3 py-2 text-xs text-danger hover:bg-danger-fill/10 disabled:opacity-50"
          >
            {deleteCard.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
      {deleteCard.error && <p role="alert" className="text-sm text-danger">{deleteCard.error.message}</p>}
      
      </div>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 truncate rounded-md bg-raised px-3 py-2 font-mono text-base text-bright">
          {card.code}
        </span>
        <button
          onClick={copyCode}
          title="Copy code"
          className="shrink-0 rounded bg-edge/60 px-1.5 py-0.5 text-xs text-subtle hover:bg-edge-strong hover:text-foreground"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-subtle">
        {card.pin && (
          <span className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPin((v) => !v)}
              title={showPin ? "Hide PIN" : "Show PIN"}
              className="hover:text-soft"
            >
              PIN:{" "}
              <span className="font-mono">{showPin ? card.pin : "••••"}</span>
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(card.pin ?? "");
                setCopiedPin(true);
                setTimeout(() => setCopiedPin(false), 1500);
              }}
              title="Copy PIN"
              className="rounded bg-edge/60 px-1.5 py-0.5 text-xs hover:bg-edge-strong hover:text-foreground"
            >
              {copiedPin ? "Copied!" : "Copy"}
            </button>
          </span>
        )}
        {card.expiresAt && (
          <span className={expired ? "font-semibold text-danger" : ""}>
            {expired ? "Expired" : "Expires"} {dateFormat.format(card.expiresAt)}
          </span>
        )}
      </div>

      {card.notes && <p className="break-words text-sm text-muted">{card.notes}</p>}
    </div>
  );
}
