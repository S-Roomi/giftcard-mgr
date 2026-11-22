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

  const [copied, setCopied] = useState<"code" | "pin" | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copy = async (which: "code" | "pin") => {
    const text = which === "code" ? card.code : card.pin;
    const what = which === "code" ? "Code" : "PIN";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onAnnounce(`${what} copied`);
      setCopied(which);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      onAnnounce(`Could not copy ${what.toLowerCase()}`);
    }
  };

  // Clicking the value copies it, unless the user just dragged to select part of it.
  const copyOnClick = (which: "code" | "pin") => () => {
    if (window.getSelection()?.toString()) return;
    void copy(which);
  };

  return (
    <>
      <tr
        className={`border-t border-edge max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3 ${
          soon ? "bg-warning-fill/10" : ""
        } ${dimmed ? "text-muted" : "text-foreground"}`}
      >
        <td className="px-5 py-3 align-top max-md:col-start-1 max-md:p-0">
          <div className="flex items-center gap-1">
            {/* Mouse and touch shortcut; keyboard and screen readers use the labeled button beside it. */}
            <span
              onClick={copyOnClick("code")}
              title="Click to copy"
              className={`-mx-1 min-w-0 cursor-copy break-all rounded px-1 font-mono text-[0.8125rem] hover:bg-raised ${dimmed ? "" : "text-bright"}`}
            >
              {card.code}
            </span>
            <IconButton
              label={`Copy code for card ending ${lastFour}`}
              onClick={() => void copy("code")}
              done={copied === "code"}
              icon={<CopyIcon />}
            />
          </div>
          {card.notes && <p className="mt-0.5 break-words text-xs text-muted">{card.notes}</p>}
        </td>
        <td data-label="PIN" className={`px-2 py-3 align-top font-mono max-md:col-start-1 max-md:p-0 ${cellLabel}`}>
          {card.pin ? (
            <span className="inline-flex items-center gap-1">
              <span
                onClick={copyOnClick("pin")}
                title="Click to copy"
                className={`-mx-1 cursor-copy whitespace-nowrap rounded px-1 hover:bg-raised ${showPin ? "" : "text-subtle"}`}
              >
                {showPin ? card.pin : <span aria-label="PIN hidden">••••</span>}
              </span>
              <IconButton
                label={`${showPin ? "Hide" : "Show"} PIN for card ending ${lastFour}`}
                pressed={showPin}
                onClick={() => setShowPin((value) => !value)}
                icon={showPin ? <EyeOffIcon /> : <EyeIcon />}
              />
              <IconButton
                label={`Copy PIN for card ending ${lastFour}`}
                onClick={() => void copy("pin")}
                done={copied === "pin"}
                icon={<CopyIcon />}
              />
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

/** A 44px icon-only button that shows a check mark briefly after it succeeds. */
function IconButton({
  label,
  icon,
  onClick,
  done = false,
  pressed,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  done?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`-my-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-edge hover:text-foreground max-md:-my-2 ${
        done ? "text-accent" : "text-subtle"
      }`}
    >
      {done ? <CheckIcon /> : icon}
    </button>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "h-4 w-4",
} as const;

function CopyIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps} strokeWidth={2.4}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
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
