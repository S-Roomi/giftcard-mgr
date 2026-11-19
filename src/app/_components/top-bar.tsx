"use client";

import { useRef } from "react";

export function TopBar({
  username,
  creatingCategory,
  onToggleCategoryForm,
  onAddCard,
  addCardDisabled,
}: {
  username: string;
  creatingCategory: boolean;
  onToggleCategoryForm: () => void;
  onAddCard: () => void;
  addCardDisabled: boolean;
}) {
  const accountRef = useRef<HTMLDetailsElement>(null);

  return (
    <header className="border-b border-edge bg-surface">
      <div className="mx-auto flex w-full max-w-md flex-wrap items-center justify-between gap-3 px-4 py-3 md:max-w-7xl md:px-6 lg:px-8">
        <h1 className="text-lg font-bold tracking-tight text-foreground">Gift Cards</h1>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleCategoryForm}
            aria-expanded={creatingCategory}
            aria-controls="new-category-form"
            className="min-h-11 rounded-md border border-edge-strong px-3 py-2 text-sm font-medium text-secondary hover:bg-raised"
          >
            New category
          </button>
          <button
            onClick={onAddCard}
            disabled={addCardDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            Add card
          </button>
          <details
            ref={accountRef}
            className="relative"
            onKeyDown={(event) => {
              if (event.key === "Escape" && accountRef.current) {
                accountRef.current.open = false;
                accountRef.current.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}
          >
            <summary
              aria-label={`Account menu for ${username}`}
              className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-edge-strong bg-raised text-sm font-semibold uppercase text-secondary hover:text-foreground [&::-webkit-details-marker]:hidden"
            >
              <span aria-hidden="true">{username.slice(0, 1)}</span>
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-edge bg-raised p-1 shadow-xl">
              <p className="truncate px-3 py-2 text-xs text-subtle">
                Signed in as <span className="font-medium text-secondary">{username}</span>
              </p>
              <form action="/api/auth/logout" method="post">
                <button className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-secondary hover:bg-edge">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
