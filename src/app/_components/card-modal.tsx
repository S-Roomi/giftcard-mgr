"use client";

import { useState } from "react";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-white">
          {card ? "Edit gift card" : "Add gift card"}
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Card code / number *
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 6273-9917-4402"
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white focus:border-emerald-500 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Balance ($) *
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="25.00"
                className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              PIN
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="optional"
                className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Expiry date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="optional"
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error.message}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Saving…" : card ? "Save changes" : "Add card"}
          </button>
        </div>
      </form>
    </div>
  );
}
