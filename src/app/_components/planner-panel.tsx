"use client";

import { useId, useState } from "react";

import { currency } from "./format";
import { codeLastFour, planSpend, roundCents, type Allocation, type GiftCard } from "./planner";

export function PlannerPanel({
  fundedCards,
  total,
  disabled,
  pending,
  error,
  onRecord,
}: {
  /** Cards with a balance, already in the category's selected sort order. */
  fundedCards: GiftCard[];
  total: number;
  disabled: boolean;
  pending: boolean;
  error: string | null;
  /** Resolves to true when the spend was saved. */
  onRecord: (selection: Allocation[], note: string | null) => Promise<boolean>;
}) {
  const id = useId();
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const { validAmount, selection, covered, shortfall } = planSpend(fundedCards, Number.parseFloat(amountStr));

  const submit = async () => {
    if (await onRecord(selection, note.trim() || null)) {
      setAmountStr("");
      setNote("");
    }
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-edge bg-surface p-4 md:p-5"
    >
      <h3 id={`${id}-heading`} className="text-base font-semibold text-foreground">Plan a spend</h3>

      {fundedCards.length === 0 ? (
        <p className="text-sm text-muted">All used up — no cards with a balance left.</p>
      ) : (
        // Not a <form>: pressing Enter in a field must not record a spend before it is reviewed.
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-amount`} className="text-sm font-medium text-secondary">Order total</label>
            <input
              id={`${id}-amount`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amountStr}
              disabled={disabled}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 20"
              className="min-h-12 w-full min-w-0 rounded-md border-2 border-edge-strong bg-surface px-3 text-xl font-semibold text-foreground [appearance:textfield] placeholder:font-normal placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          {validAmount && (
            <div className="flex flex-col rounded-lg border border-edge">
              <ul aria-label="Cards to use" className="flex flex-col">
                {selection.map(({ card, portion }) => (
                  <li key={card.id} className="flex items-start justify-between gap-3 border-b border-edge px-3.5 py-3 text-sm">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-foreground">•••• {codeLastFour(card.code)}</span>
                      <span className="text-xs text-subtle">
                        {currency.format(roundCents(card.balance - portion))} left after
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">{currency.format(portion)}</span>
                  </li>
                ))}
              </ul>
              <div aria-live="polite" className="rounded-b-lg bg-raised/60 px-3.5 py-3 text-sm">
                {shortfall > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="flex justify-between gap-3 font-semibold text-danger">
                      <span>Short</span>
                      <span>{currency.format(shortfall)}</span>
                    </span>
                    <span className="text-xs text-subtle">
                      This category only has {currency.format(total)}. Recording uses all of it.
                    </span>
                  </div>
                ) : (
                  <span className="flex justify-between gap-3 font-semibold text-foreground">
                    <span>Covered</span>
                    <span className="text-accent">
                      {currency.format(covered)} <span aria-hidden="true">✓</span>
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-note`} className="text-sm font-medium text-secondary">
              Note <span className="font-normal text-subtle">(optional)</span>
            </label>
            <input
              id={`${id}-note`}
              type="text"
              value={note}
              maxLength={200}
              disabled={disabled}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Weekly groceries"
              className="min-h-11 w-full min-w-0 rounded-md border border-edge-strong bg-surface px-3 text-base text-foreground placeholder:text-muted focus:border-primary-hover focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || selection.length === 0}
            className="min-h-12 rounded-md bg-primary px-4 text-base font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : selection.length > 0
                ? `Record ${currency.format(covered)} spend`
                : "Record spend"}
          </button>
          <p className="text-xs text-subtle">Cards are used in the sort order shown in the card list.</p>
        </div>
      )}
    </section>
  );
}
