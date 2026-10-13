"use client";

import { useEffect, useId, useRef, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

type Category = RouterOutputs["category"]["getAll"][number];
type GiftCard = Category["giftCards"][number];

export function CardModal({
  categories,
  card,
  defaultCategoryId,
  onClose,
}: {
  categories: Category[];
  card: GiftCard | null;
  defaultCategoryId: number;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const [code, setCode] = useState(card?.code ?? "");
  const [pin, setPin] = useState(card?.pin ?? "");
  const [balance, setBalance] = useState(card ? String(card.balance) : "");
  const [expiresAt, setExpiresAt] = useState(
    card?.expiresAt ? card.expiresAt.toISOString().slice(0, 10) : "",
  );
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [categoryId, setCategoryId] = useState(
    card?.categoryId ?? defaultCategoryId,
  );

  const onSuccess = async () => {
    await utils.category.getAll.invalidate();
    onClose();
  };
  const createCard = api.giftCard.create.useMutation({ onSuccess });
  const updateCard = api.giftCard.update.useMutation({ onSuccess });
  const isPending = createCard.isPending || updateCard.isPending;
  const error = createCard.error ?? updateCard.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const parsedBalance = Number.parseFloat(balance);
    if (Number.isNaN(parsedBalance) || parsedBalance < 0) return;
    const data = {
      code,
      pin: pin || null,
      balance: parsedBalance,
      expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00`) : null,
      notes: notes || null,
      categoryId,
    };
    if (card) {
      updateCard.mutate({ id: card.id, ...data });
    } else {
      createCard.mutate(data);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-edge bg-raised p-0 text-foreground shadow-xl backdrop:bg-scrim/60"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="min-w-0 p-5 sm:p-6"
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold text-foreground">
          {card ? "Edit gift card" : "Add gift card"}
        </h2>

        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
            Card code / number *
            <input
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 6273-9917-4402"
              className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 font-mono text-foreground focus:border-primary-hover focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
              Balance ($) *
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="25.00"
                className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
              PIN
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="optional"
                className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 font-mono text-foreground focus:border-primary-hover focus:outline-none"
              />
            </label>
          </div>

          <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
            Expiry date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm text-secondary">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="optional"
              className="min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none"
            />
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">{error.message}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-secondary hover:bg-edge"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "Saving…" : card ? "Save changes" : "Add card"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
