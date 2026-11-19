"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { api } from "~/trpc/react";
import { currency, dateFormat } from "./format";
import { SORT_OPTIONS, codeLastFour, isExpiringSoon, isSortKey, sortCards, type GiftCard, type SortKey } from "./planner";

export function CardTable({
  categoryName,
  cards,
  sort,
  onSortChange,
  onAddCard,
  onEditCard,
  disabled,
}: {
  categoryName: string;
  cards: GiftCard[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  onAddCard: () => void;
  onEditCard: (card: GiftCard) => void;
  disabled: boolean;
}) {
  const headingId = useId();
  const [status, setStatus] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = (message: string) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 2000);
  };
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const now = new Date();

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-xl border border-edge bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3 md:px-5">
        <h3 id={headingId} className="text-base font-semibold text-foreground">Cards</h3>
        <span role="status" className="text-xs text-accent empty:hidden">{status}</span>
        {cards.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-subtle">
            Sort by
            <select
              aria-label={`Sort cards in ${categoryName}`}
              value={sort}
              disabled={disabled}
              onChange={(event) => {
                if (isSortKey(event.target.value)) onSortChange(event.target.value);
              }}
              className="min-h-11 rounded-md border border-edge-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary-hover focus:outline-none disabled:opacity-50"
            >
              {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-4 py-5 text-sm text-subtle md:px-5">
          <p>No cards in this category yet.</p>
          <button disabled={disabled} onClick={onAddCard} className="min-h-11 rounded-md px-3 py-2 text-accent hover:bg-edge disabled:opacity-50">
            + Add card
          </button>
        </div>
      ) : (
        // Below 768px rows restyle into stacked blocks; wider tables scroll in this box.
        <div className="md:overflow-x-auto">
          <table className="w-full border-collapse text-sm max-md:block md:min-w-[36rem]">
            <thead className="max-md:sr-only">
              <tr className="text-left text-xs text-subtle">
                <th scope="col" className="px-5 py-2.5 font-medium">Code</th>
                <th scope="col" className="px-2 py-2.5 font-medium">PIN</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Expires</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">Balance</th>
                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {sortCards(cards, sort).map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  now={now}
                  disabled={disabled}
                  onEdit={() => onEditCard(card)}
                  onAnnounce={announce}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cellLabel =
  "max-md:flex max-md:items-baseline max-md:gap-2 max-md:before:w-16 max-md:before:shrink-0 max-md:before:text-xs max-md:before:text-subtle max-md:before:content-[attr(data-label)]";

function CardRow({
  card,
  now,
  disabled,
  onEdit,
  onAnnounce,
}: {
  card: GiftCard;
  now: Date;
  disabled: boolean;
  onEdit: () => void;
  onAnnounce: (message: string) => void;
}) {
  const utils = api.useUtils();
  const deleteCard = api.giftCard.delete.useMutation({
    // History keeps the deleted card's entries, so refresh it to show them as deleted.
    onSuccess: () => Promise.all([utils.category.getAll.invalidate(), utils.category.history.invalidate()]),
  });
  const [showPin, setShowPin] = useState(false);

  const expired = card.expiresAt !== null && card.expiresAt < now;
  const soon = isExpiringSoon(card, now);
  const dimmed = expired || card.balance <= 0;
  const lastFour = codeLastFour(card.code);
  const busy = disabled || deleteCard.isPending;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onAnnounce(`${what} copied`);
    } catch {
      onAnnounce(`Could not copy ${what.toLowerCase()}`);
    }
  };

  return (
    <>
      <tr
        className={`border-t border-edge max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3 ${
          soon ? "bg-warning-fill/10" : ""
        } ${dimmed ? "text-muted" : "text-foreground"}`}
      >
        <td className="px-5 py-3 align-top max-md:col-start-1 max-md:p-0">
          <span className={`break-all font-mono text-[0.8125rem] ${dimmed ? "" : "text-bright"}`}>{card.code}</span>
          {card.notes && <p className="mt-0.5 break-words text-xs text-muted">{card.notes}</p>}
        </td>
        <td data-label="PIN" className={`px-2 py-3 align-top font-mono max-md:col-start-1 max-md:p-0 ${cellLabel}`}>
          {card.pin ? (
            <span className={showPin ? "" : "text-subtle"}>
              {showPin ? card.pin : <span aria-label="PIN hidden">••••</span>}
            </span>
          ) : (
            <span className="font-sans text-muted" aria-label="No PIN">—</span>
          )}
        </td>
        <td data-label="Expires" className={`px-2 py-3 align-top max-md:col-start-1 max-md:p-0 ${cellLabel}`}>
          {card.expiresAt === null ? (
            <span className="text-subtle">No expiry</span>
          ) : expired ? (
            <span className="font-semibold text-danger">Expired {dateFormat.format(card.expiresAt)}</span>
          ) : soon ? (
            <span className="whitespace-nowrap rounded-full bg-warning-fill/20 px-2 py-0.5 text-xs font-medium text-warning">
              {dateFormat.format(card.expiresAt)}
              <span className="sr-only"> (expires soon)</span>
            </span>
          ) : (
            <span className="whitespace-nowrap">{dateFormat.format(card.expiresAt)}</span>
          )}
        </td>
        <td
          data-label="Balance"
          className={`whitespace-nowrap px-2 py-3 text-right align-top font-semibold max-md:col-start-1 max-md:p-0 max-md:text-left ${cellLabel}`}
        >
          {currency.format(card.balance)}
        </td>
        <td className="px-5 py-2 text-right align-top max-md:col-start-2 max-md:row-span-4 max-md:row-start-1 max-md:p-0">
          <RowMenu label={`Actions for card ending ${lastFour}`}>
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); void copy(card.code, "Code"); }}>Copy code</MenuItem>
                {card.pin && (
                  <>
                    <MenuItem onClick={() => { close(); setShowPin((value) => !value); }}>
                      {showPin ? "Hide PIN" : "Show PIN"}
                    </MenuItem>
                    <MenuItem onClick={() => { close(); void copy(card.pin ?? "", "PIN"); }}>Copy PIN</MenuItem>
                  </>
                )}
                <MenuItem disabled={busy} onClick={() => { close(); onEdit(); }}>Edit</MenuItem>
                <MenuItem
                  danger
                  disabled={busy}
                  onClick={() => {
                    close();
                    if (confirm("Delete this gift card? This cannot be undone.")) deleteCard.mutate({ id: card.id });
                  }}
                >
                  {deleteCard.isPending ? "Deleting…" : "Delete"}
                </MenuItem>
              </>
            )}
          </RowMenu>
        </td>
      </tr>
      {deleteCard.error && (
        <tr className="max-md:block">
          <td colSpan={5} className="px-5 pb-3 max-md:block max-md:px-4">
            <p role="alert" className="text-sm text-danger">{deleteCard.error.message}</p>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * A menu rendered in the top layer with the Popover API, so the table's scroll
 * box cannot clip it. It is placed next to its button and closes on scroll.
 */
function RowMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = () => menuRef.current?.hidePopover();

  useEffect(() => {
    if (!open) return;
    const hide = () => menuRef.current?.hidePopover();
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        popoverTarget={id}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-subtle hover:bg-edge hover:text-foreground"
      >
        <span aria-hidden="true">•••</span>
      </button>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="group"
        aria-label={label}
        onBeforeToggle={(event) => {
          // Place the menu under its button before it is shown.
          const button = buttonRef.current;
          const menu = menuRef.current;
          if (event.newState !== "open" || !button || !menu) return;
          const rect = button.getBoundingClientRect();
          menu.style.top = `${rect.bottom + 4}px`;
          menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
        }}
        onToggle={(event) => {
          const opening = event.newState === "open";
          setOpen(opening);
          const button = buttonRef.current;
          const menu = menuRef.current;
          // The browser returns focus to the button when the menu closes.
          if (!opening || !button || !menu) return;
          // Flip above the button when there is no room below.
          const rect = button.getBoundingClientRect();
          if (rect.bottom + 4 + menu.offsetHeight > window.innerHeight) {
            menu.style.top = `${Math.max(8, rect.top - 4 - menu.offsetHeight)}px`;
          }
          menu.querySelector("button")?.focus();
        }}
        className="fixed inset-auto m-0 w-44 rounded-lg border border-edge bg-raised p-1 text-left text-foreground shadow-xl"
      >
        {children(close)}
      </div>
    </>
  );
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 w-full rounded px-3 py-2 text-left text-sm disabled:opacity-50 ${
        danger ? "text-danger hover:bg-danger-fill/10" : "text-secondary hover:bg-edge"
      }`}
    >
      {children}
    </button>
  );
}
