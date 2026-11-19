"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { api } from "~/trpc/react";
import { currency } from "./format";
import { CardTable } from "./card-table";
import { CardModal } from "./card-modal";
import { CategoryForm } from "./category-form";
import { CategoryHistory } from "./category-history";
import { CategorySidebar } from "./category-sidebar";
import { PlannerPanel } from "./planner-panel";
import {
  roundCents,
  sortCards,
  type Allocation,
  type Category,
  type GiftCard,
} from "./planner";
import { TopBar } from "./top-bar";
import { useCategorySort } from "./use-category-sort";

export function UsePage({ username }: { username: string }) {
  const [categories] = api.category.getAll.useSuspenseQuery();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [modal, setModal] = useState<{
    card: GiftCard | null;
    categoryId: number;
  } | null>(null);

  // The selected category lives in the URL; unknown or deleted IDs fall back to the first.
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("category");
  const selected = categories.find((category) => String(category.id) === requestedId) ?? categories[0];

  const selectCategory = (id: number) => {
    if (id === selected?.id && requestedId === String(id)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", String(id));
    // Next.js syncs pushState with useSearchParams, so back/forward restore the selection.
    window.history.pushState(null, "", `?${params.toString()}`);
  };

  return (
    <>
      <TopBar
        username={username}
        creatingCategory={creatingCategory}
        onToggleCategoryForm={() => setCreatingCategory((value) => !value)}
        onAddCard={() => {
          if (selected) setModal({ card: null, categoryId: selected.id });
        }}
        addCardDisabled={!selected}
      />

      <main className="mx-auto w-full max-w-md px-4 py-6 md:max-w-7xl md:px-6 md:py-8 lg:px-8">
        {creatingCategory && (
          <div id="new-category-form" className="mb-6 w-full rounded-xl border border-edge bg-raised/60 p-5 md:max-w-md">
            <CategoryForm onClose={() => setCreatingCategory(false)} />
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
          <CategorySidebar
            categories={categories}
            selectedId={selected?.id ?? null}
            onSelect={selectCategory}
          />

          <section aria-label="Selected category" className="min-w-0">
            {selected ? (
              <CategoryPlanner
                key={selected.id}
                category={selected}
                onAddCard={() => setModal({ card: null, categoryId: selected.id })}
                onEditCard={(card) => setModal({ card, categoryId: selected.id })}
              />
            ) : (
              <div className="w-full rounded-xl border border-dashed border-edge px-6 py-12 text-center text-subtle md:py-20">
                No categories yet. Choose “New category” above to get started,
                then add your first gift card.
              </div>
            )}
          </section>
        </div>
      </main>

      {modal && (
        <CardModal
          categories={categories}
          card={modal.card}
          defaultCategoryId={modal.categoryId}
          onClose={() => setModal(null)}
        />
      )}
    </>
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
  const [sort, changeSort] = useCategorySort(category.id);

  const [renaming, setRenaming] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => utils.category.getAll.invalidate(),
  });
  const spend = api.category.spend.useMutation();
  const busy = spend.isPending || deleteCategory.isPending;

  const funded = sortCards(
    category.giftCards.filter((g) => g.balance > 0),
    sort,
  );
  const total = roundCents(funded.reduce((s, g) => s + g.balance, 0));

  const recordSpend = async (selection: Allocation[], note: string | null) => {
    try {
      // The server charges every selected card or none of them, and records the spend.
      await spend.mutateAsync({
        categoryId: category.id,
        note,
        allocations: selection.map(({ card, portion }) => ({ cardId: card.id, amount: portion })),
      });
      return true;
    } catch {
      // The mutation error is shown in the planner; balances are refreshed either way.
      return false;
    } finally {
      await Promise.all([
        utils.category.getAll.invalidate(),
        utils.category.history.invalidate({ categoryId: category.id }),
      ]);
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <span className="text-sm text-subtle">Category</span>
          <div className="flex items-start gap-1">
            <h2 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground md:text-3xl">{category.name}</h2>
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
        </div>
        <dl className="flex gap-8">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-subtle">Available</dt>
            <dd className="text-xl font-bold text-accent">{currency.format(total)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-subtle">Cards</dt>
            <dd className="text-xl font-bold text-foreground">{category.giftCards.length}</dd>
          </div>
        </dl>
      </header>

      {renaming && <CategoryForm category={category} onClose={() => setRenaming(false)} />}
      {deleteCategory.error && <p role="alert" className="text-sm text-danger">{deleteCategory.error.message}</p>}

      {/* From 1280px the planner sits beside the table and history; narrower screens stack
          cards, planner, then history. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr] xl:gap-6">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <CardTable
            categoryName={category.name}
            cards={category.giftCards}
            sort={sort}
            onSortChange={changeSort}
            onAddCard={onAddCard}
            onEditCard={onEditCard}
            disabled={busy}
          />
        </div>
        {category.giftCards.length > 0 && (
          <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <PlannerPanel
              fundedCards={funded}
              total={total}
              disabled={busy}
              pending={spend.isPending}
              error={spend.error?.message ?? null}
              onRecord={recordSpend}
            />
          </div>
        )}
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <CategoryHistory categoryId={category.id} />
        </div>
      </div>
    </div>
  );
}
