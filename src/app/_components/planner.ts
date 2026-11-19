import type { RouterOutputs } from "~/trpc/react";

export type Category = RouterOutputs["category"]["getAll"][number];
export type GiftCard = Category["giftCards"][number];

export const SORT_OPTIONS = {
  "expiry-soonest": "Soonest expiry",
  "value-highest": "Highest value",
  "value-lowest": "Lowest value",
  oldest: "Oldest first",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const DEFAULT_SORT: SortKey = "expiry-soonest";

export function isSortKey(value: string): value is SortKey {
  return Object.prototype.hasOwnProperty.call(SORT_OPTIONS, value);
}

export function sortCards(cards: GiftCard[], sort: SortKey): GiftCard[] {
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

export const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Last four characters of a card code, for labels that should not show the full code. */
export function codeLastFour(code: string): string {
  return code.replace(/\s/g, "").slice(-4);
}

/** Sum of the positive card balances, rounded to cents. */
export function availableBalance(cards: GiftCard[]): number {
  return roundCents(cards.reduce((s, g) => s + (g.balance > 0 ? g.balance : 0), 0));
}

export const EXPIRING_SOON_DAYS = 30;

/** A card with money left that expires within the next 30 days. */
export function isExpiringSoon(card: GiftCard, now: Date): boolean {
  if (card.expiresAt === null || card.balance <= 0) return false;
  const remaining = card.expiresAt.getTime() - now.getTime();
  return remaining >= 0 && remaining <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}

export type Allocation = { card: GiftCard; portion: number };

export type SpendPlan = {
  validAmount: boolean;
  selection: Allocation[];
  covered: number;
  shortfall: number;
};

/**
 * Pick cards in the given order until `amount` is covered. `cards` should
 * already be filtered to funded cards and sorted by the category's sort.
 */
export function planSpend(cards: GiftCard[], amount: number): SpendPlan {
  const validAmount = !Number.isNaN(amount) && amount > 0;
  const selection: Allocation[] = [];
  if (validAmount) {
    let remaining = amount;
    for (const card of cards) {
      if (remaining <= 0) break;
      const portion = roundCents(Math.min(card.balance, remaining));
      selection.push({ card, portion });
      remaining = roundCents(remaining - portion);
    }
  }
  const covered = roundCents(selection.reduce((s, x) => s + x.portion, 0));
  const shortfall = validAmount ? roundCents(amount - covered) : 0;
  return { validAmount, selection, covered, shortfall };
}
