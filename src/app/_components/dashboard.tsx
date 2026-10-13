"use client";

import Link from "next/link";
import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { CardModal } from "./card-modal";
import { currency, dateFormat } from "./format";

type Category = RouterOutputs["category"]["getAll"][number];
type GiftCard = Category["giftCards"][number];

export function Dashboard() {
  const [categories] = api.category.getAll.useSuspenseQuery();
  const utils = api.useUtils();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [modal, setModal] = useState<{
    card: GiftCard | null;
    categoryId: number;
  } | null>(null);

  const createCategory = api.category.create.useMutation({
    onSuccess: async () => {
      setNewCategoryName("");
      await utils.category.getAll.invalidate();
    },
  });

  const totalBalance = categories.reduce(
    (sum, c) => sum + c.giftCards.reduce((s, g) => s + g.balance, 0),
    0,
  );
  const cardCount = categories.reduce((n, c) => n + c.giftCards.length, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground"> Gift Card Manager </h1>
          <p className="mt-1 text-sm text-subtle">
            {cardCount} card{cardCount === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-accent">
              {currency.format(totalBalance)}
            </span>{" "}
            total balance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategoryName.trim()) {
                createCategory.mutate({ name: newCategoryName });
              }
            }}
            className="flex gap-2"
          >
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category"
              className="w-56 rounded-md border border-edge-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary-hover focus:outline-none"
            />
            <button
              type="submit"
              disabled={createCategory.isPending || !newCategoryName.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              Add category
            </button>
          </form>
          <Link
            href="/"
            className="rounded-md border border-edge-strong px-4 py-2 text-sm font-medium text-secondary hover:bg-raised hover:text-foreground"
          >
            Use cards
          </Link>
        </div>
      </header>

      {createCategory.error && (
        <p className="mb-4 text-sm text-danger">
          {createCategory.error.message.includes("Unique constraint")
            ? "A category with that name already exists."
            : createCategory.error.message}
        </p>
      )}

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge p-12 text-center text-subtle">
          No categories yet. Create one above, then add your gift cards to it.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              onAddCard={() =>
                setModal({ card: null, categoryId: category.id })
              }
              onEditCard={(card) =>
                setModal({ card, categoryId: category.id })
              }
            />
          ))}
        </div>
      )}

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

function CategorySection({
  category,
  onAddCard,
  onEditCard,
}: {
  category: Category;
  onAddCard: () => void;
  onEditCard: (card: GiftCard) => void;
}) {
  const utils = api.useUtils();
  const [editingName, setEditingName] = useState<string | null>(null);

  const renameCategory = api.category.rename.useMutation({
    onSuccess: async () => {
      setEditingName(null);
      await utils.category.getAll.invalidate();
    },
  });
  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => utils.category.getAll.invalidate(),
  });

  const sectionTotal = category.giftCards.reduce((s, g) => s + g.balance, 0);

  return (
    <section className="rounded-xl border border-edge/70 bg-raised/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {editingName !== null ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingName.trim()) {
                  renameCategory.mutate({
                    id: category.id,
                    name: editingName,
                  });
                }
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="rounded-md border border-edge-strong bg-surface px-2 py-1 text-foreground focus:border-primary-hover focus:outline-none"
              />
              <button
                type="submit"
                className="text-sm text-accent hover:text-accent-hover"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(null)}
                className="text-sm text-subtle hover:text-secondary"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground">
                {category.name}
              </h2>
              <span className="rounded-full bg-edge px-2.5 py-0.5 text-xs font-medium text-accent-hover">
                {currency.format(sectionTotal)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAddCard}
            className="rounded-md bg-primary/90 px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            + Add card
          </button>
          <button
            onClick={() => setEditingName(category.name)}
            className="rounded-md px-2 py-1.5 text-sm text-subtle hover:bg-edge hover:text-foreground"
            title="Rename category"
          >
            Rename
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  `Delete "${category.name}" and its ${category.giftCards.length} card(s)?`,
                )
              ) {
                deleteCategory.mutate({ id: category.id });
              }
            }}
            className="rounded-md px-2 py-1.5 text-sm text-danger/80 hover:bg-danger-fill/10 hover:text-danger"
            title="Delete category"
          >
            Delete
          </button>
        </div>
      </div>

      {category.giftCards.length === 0 ? (
        <p className="text-sm text-muted">No cards in this category.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {category.giftCards.map((card) => (
            <GiftCardTile
              key={card.id}
              card={card}
              onEdit={() => onEditCard(card)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GiftCardTile({ card, onEdit, }: {card: GiftCard; onEdit: () => void; }) {
  const utils = api.useUtils();
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deductAmount, setDeductAmount] = useState("");

  const deleteCard = api.giftCard.delete.useMutation({
    onSuccess: () => utils.category.getAll.invalidate(),
  });
  const deductFromCard = api.giftCard.deduct.useMutation({
    onSuccess: async () => {
      setDeductAmount("");
      await utils.category.getAll.invalidate();
    },
  });

  const expired = card.expiresAt !== null && card.expiresAt < new Date();

  const copyCode = async () => {
    await navigator.clipboard.writeText(card.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-edge bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-bold text-accent">
          {currency.format(card.balance)}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded px-2 py-1 text-xs text-subtle hover:bg-edge hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this gift card?")) {
                deleteCard.mutate({ id: card.id });
              }
            }}
            className="rounded px-2 py-1 text-xs text-danger/80 hover:bg-danger-fill/10 hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>

      <button
        onClick={copyCode}
        title="Click to copy"
        className="w-fit max-w-full truncate rounded bg-raised px-2 py-1 text-left font-mono text-sm text-soft hover:bg-edge"
      >
        {copied ? "Copied!" : card.code}
      </button>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
        {card.pin && (
          <button
            onClick={() => setShowPin((v) => !v)}
            className="hover:text-soft"
          >
            PIN:{" "}
            <span className="font-mono">
              {showPin ? card.pin : "••••"}
            </span>
          </button>
        )}
        {card.expiresAt && (
          <span className={expired ? "font-semibold text-danger" : ""}>
            {expired ? "Expired" : "Expires"}{" "}
            {dateFormat.format(card.expiresAt)}
          </span>
        )}
      </div>

      {card.notes && (
        <p className="text-xs text-muted">{card.notes}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amount = Number.parseFloat(deductAmount);
          if (Number.isNaN(amount) || amount <= 0) return;
          deductFromCard.mutate({ id: card.id, amount });
        }}
        className="mt-1 flex gap-2"
      >
        <input
          type="number"
          min="0"
          value={deductAmount}
          onChange={(e) => setDeductAmount(e.target.value)}
          className="w-24 rounded-md border border-edge bg-raised px-2 py-1 text-sm text-foreground [appearance:textfield] focus:border-warning-focus focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="submit"
          disabled={deductFromCard.isPending || !deductAmount}
          className="rounded-md bg-warning-fill/20 px-3 py-1 text-sm font-medium text-warning hover:bg-warning-fill/30 disabled:opacity-50"
        >
          {deductFromCard.isPending ? "…" : "Used"}
        </button>
      </form>
    </div>
  );
}
