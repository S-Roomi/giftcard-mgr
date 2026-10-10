import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const giftCardFields = {
  code: z.string().trim().min(1).max(200),
  pin: z.string().trim().max(50).nullish(),
  balance: z.number().min(0),
  expiresAt: z.coerce.date().nullish(),
  notes: z.string().trim().max(1000).nullish(),
  categoryId: z.number().int(),
};

export const giftCardRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object(giftCardFields))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.giftCard.create({
        data: {
          ...input,
          pin: input.pin ?? null,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int(), ...giftCardFields }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.giftCard.update({
        where: { id },
        data: {
          ...data,
          pin: data.pin ?? null,
          expiresAt: data.expiresAt ?? null,
          notes: data.notes ?? null,
        },
      });
    }),

  deduct: protectedProcedure
    .input(z.object({ id: z.number().int(), amount: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db.giftCard.findUniqueOrThrow({
        where: { id: input.id },
      });
      const newBalance = Math.max(
        0,
        Math.round((card.balance - input.amount) * 100) / 100,
      );
      return ctx.db.giftCard.update({
        where: { id: input.id },
        data: { balance: newBalance },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.giftCard.delete({
        where: { id: input.id },
      });
    }),
});
