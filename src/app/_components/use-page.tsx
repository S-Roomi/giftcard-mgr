"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { currency, dateFormat } from "./format";

type Category = RouterOutputs["category"]["getAll"][number];
type GiftCard = Category["giftCards"][number];

const SORT_OPTIONS = {
  "expiry-soonest": "Soonest expiry",
  "value-highest": "Highest value",
  "value-lowest": "Lowest value",
  oldest: "Oldest first",
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const SORT_STORAGE_KEY = "giftcard-use-sort";

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
  const [sort, setSort] = useState<SortKey>("expiry-soonest");

  useEffect(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved && saved in SORT_OPTIONS) setSort(saved as SortKey);
  }, []);

  const changeSort = (value: SortKey) => {
    setSort(value);
    localStorage.setItem(SORT_STORAGE_KEY, value);
  };

  const visible = categories.filter((c) => c.giftCards.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <header className="mx-auto mb-6 flex w-full max-w-md flex-col items-center gap-4 text-center md:mb-8 md:max-w-none md:flex-row md:flex-wrap md:justify-between md:text-left">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Your Gift Cards</h1>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-3 md:w-auto md:justify-end">
          <label className="flex items-center gap-2 text-sm text-subtle">
            Sort by
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as SortKey)}
              className="min-h-11 rounded-md border border-edge-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary-hover focus:outline-none"
            >
              {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/manage"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
          >
            Manage cards
          </Link>
        </div>
      </header>

      <div className="flex justify-center">
        {visible.length === 0 ? (
          <div className="w-full max-w-md rounded-xl border border-dashed border-edge px-6 py-12 text-center text-subtle md:max-w-none md:py-20">
            No gift cards yet.{" "}
            <Link href="/manage" className="text-accent hover:underline">
              Add some in the manager
            </Link>
          </div>
        ) : (
          <div className="grid w-full max-w-md grid-cols-1 items-start gap-5 md:max-w-none md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {visible.map((category) => (
              <CategoryPlanner
                key={category.id}
                category={category}
                sort={sort}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPlanner({
  category,
  sort,
}: {
  category: Category;
  sort: SortKey;
}) {
  const utils = api.useUtils();
  const [amountStr, setAmountStr] = useState("");
  const [isSpending, setIsSpending] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
    } finally {
      setIsSpending(false);
      await utils.category.getAll.invalidate();
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-4 rounded-xl border border-edge bg-raised/60 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold text-foreground">{category.name}</h2>
          <p className="mt-0.5 text-sm text-subtle">
            {funded.length} card{funded.length === 1 ? "" : "s"} available
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-2xl font-bold text-accent">
            {currency.format(total)}
          </span>
          <button
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="text-xs text-subtle hover:text-foreground"
          >
            {showAll ? "Hide cards" : "Show all cards"}
          </button>
        </div>
      </div>

      {showAll && (
        <div className="flex flex-col gap-3">
          {sortCards(category.giftCards, sort).map((card) => (
            <PlannedCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {funded.length === 0 ? (
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
                disabled={isSpending || selection.length === 0}
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

function PlannedCard({ card, portion }: { card: GiftCard; portion?: number }) {
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
