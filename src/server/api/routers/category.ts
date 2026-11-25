import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const roundCents = (n: number) => Math.round(n * 100) / 100;

// History keeps only a masked suffix so card codes are never stored or returned twice.
function maskCardCode(code: string) {
  return code.length >= 8 ? `•••• ${code.slice(-4)}` : "••••";
}

export const categoryRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        giftCards: {
          orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
        },
      },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      // New categories go to the end of the sidebar.
      const last = await ctx.db.category.aggregate({ _max: { position: true } });
      return ctx.db.category.create({
        data: { name: input.name, position: (last._max.position ?? -1) + 1 },
      });
    }),

  // Saves the sidebar order. The list must name every category exactly once, so an order
  // built from a stale list (a category added or deleted meanwhile) is rejected, not merged.
  reorder: protectedProcedure
    .input(
      z.object({
        ids: z
          .array(z.number().int())
          .max(1000)
          .refine((ids) => new Set(ids).size === ids.length, "Each category can only appear once."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        const existing = await tx.category.findMany({ select: { id: true } });
        const requested = new Set(input.ids);
        if (existing.length !== input.ids.length || existing.some(({ id }) => !requested.has(id))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Categories changed since the page loaded. Refresh and try again.",
          });
        }
        for (const [position, id] of input.ids.entries()) {
          await tx.category.update({ where: { id }, data: { position } });
        }
      });
    }),

  rename: protectedProcedure
    .input(
      z.object({ id: z.number().int(), name: z.string().trim().min(1).max(100) }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Deducts a planner selection from several cards and records it in one database transaction:
  // either every card is charged and the history saved, or nothing changes.
  spend: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int(),
        note: z.string().trim().max(200).nullish(),
        allocations: z
          .array(z.object({ cardId: z.number().int(), amount: z.number().positive() }))
          .min(1)
          .max(100)
          .refine(
            (items) => new Set(items.map((item) => item.cardId)).size === items.length,
            "Each card can only be used once per spend.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      return ctx.db.$transaction(async (tx) => {
        const cards = await tx.giftCard.findMany({
          where: { id: { in: input.allocations.map((item) => item.cardId) } },
        });
        const cardsById = new Map(cards.map((card) => [card.id, card]));

        const entries: { giftCardId: number; cardLabel: string; amount: number; balanceAfter: number }[] = [];
        for (const allocation of input.allocations) {
          const card = cardsById.get(allocation.cardId);
          if (card?.categoryId !== input.categoryId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A selected card is no longer in this category. Refresh and try again.",
            });
          }
          const amount = roundCents(allocation.amount);
          if (amount <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Each amount must be at least $0.01." });
          }
          if (amount > roundCents(card.balance)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A selected card does not have enough balance. Refresh and try again.",
            });
          }
          const balanceAfter = roundCents(card.balance - amount);
          // Only update if the balance is unchanged since it was read, so concurrent spends
          // cannot both draw on the same money.
          const updated = await tx.giftCard.updateMany({
            where: { id: card.id, balance: card.balance },
            data: { balance: balanceAfter },
          });
          if (updated.count !== 1) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A card balance changed while saving. Refresh and try again.",
            });
          }
          entries.push({ giftCardId: card.id, cardLabel: maskCardCode(card.code), amount, balanceAfter });
        }

        return tx.transaction.create({
          data: {
            categoryId: input.categoryId,
            amount: roundCents(entries.reduce((sum, entry) => sum + entry.amount, 0)),
            note: input.note || null,
            userId,
            entries: { create: entries },
          },
          include: { entries: true },
        });
      });
    }),

  // Spends for one category, newest first, paginated by transaction ID. IDs only increase, so
  // they give the true save order even if the system clock jumps (createdAt is display-only).
  history: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int(),
        cursor: z.number().int().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.transaction.findMany({
        where: { categoryId: input.categoryId },
        orderBy: { id: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          amount: true,
          note: true,
          createdAt: true,
          user: { select: { username: true } },
          entries: {
            orderBy: { id: "asc" },
            select: { id: true, giftCardId: true, cardLabel: true, amount: true, balanceAfter: true },
          },
        },
      });
      // One extra row is fetched only to detect another page; the cursor is the last row returned.
      const hasMore = items.length > input.limit;
      if (hasMore) items.pop();
      const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;
      return { items, nextCursor };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.delete({
        where: { id: input.id },
      });
    }),
});
