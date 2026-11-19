"use client";

import { useId, useState } from "react";

import { api } from "~/trpc/react";
import { currency, dateTimeFormat } from "./format";

/** How many spends show before "View full history". */
const PREVIEW_COUNT = 5;

/** Inline spend history for one category, newest first (ordered by transaction ID). */
export function CategoryHistory({ categoryId }: { categoryId: number }) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const history = api.category.history.useInfiniteQuery(
    { categoryId },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hasHidden = items.length > PREVIEW_COUNT || history.hasNextPage;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 rounded-xl border border-edge bg-surface px-4 py-3 md:px-5">
      <h3 id={headingId} className="text-base font-semibold text-foreground">History</h3>

      {history.isPending ? (
        <p className="pb-1 text-sm text-subtle">Loading history…</p>
      ) : history.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-danger">{history.error.message}</p>
          <button onClick={() => void history.refetch()} className="min-h-11 rounded-md px-3 py-2 text-sm text-accent hover:bg-edge">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="pb-1 text-sm text-subtle">No spends recorded yet.</p>
      ) : (
        <ul id={listId} className="-mx-2 flex flex-col">
          {visible.map((item) => {
            const cards = item.entries.length;
            return (
              <li key={item.id} className="border-t border-edge first:border-t-0">
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-raised [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {item.note ? (
                        <span className="break-words text-sm font-medium text-foreground">{item.note}</span>
                      ) : (
                        <span className="text-sm text-subtle">No note</span>
                      )}
                      <span className="text-xs text-subtle">
                        <time dateTime={item.createdAt.toISOString()}>{dateTimeFormat.format(item.createdAt)}</time>
                        {" · "}
                        {item.user?.username ?? "a removed account"}
                        {" · "}
                        {cards} card{cards === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        <span aria-hidden="true">−</span>
                        <span className="sr-only">spent </span>
                        {currency.format(item.amount)}
                      </span>
                      <span aria-hidden="true" className="text-xs text-subtle transition-transform group-open:rotate-180">▾</span>
                    </span>
                  </summary>
                  <ul aria-label="Cards charged" className="flex flex-col gap-0.5 px-2 pb-3 text-xs text-subtle">
                    {item.entries.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap justify-between gap-x-3">
                        <span className="font-mono">
                          {entry.cardLabel}
                          {entry.giftCardId === null && <span className="font-sans text-muted"> (deleted card)</span>}
                        </span>
                        <span>
                          {currency.format(entry.amount)} · {currency.format(entry.balanceAfter)} left
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {!history.isPending && !history.isError && (hasHidden || expanded) && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {expanded && history.hasNextPage && (
            <button
              onClick={() => void history.fetchNextPage()}
              disabled={history.isFetchingNextPage}
              className="min-h-11 rounded-md border border-edge-strong px-3 py-2 text-sm text-secondary hover:bg-raised disabled:opacity-50"
            >
              {history.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
          <button
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={listId}
            className="min-h-11 rounded-md px-1 py-2 text-sm font-semibold text-accent hover:text-accent-hover"
          >
            {expanded ? "Show recent only" : <>View full history <span aria-hidden="true">→</span></>}
          </button>
        </div>
      )}
    </section>
  );
}
