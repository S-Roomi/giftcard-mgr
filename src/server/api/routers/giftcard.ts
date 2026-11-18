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

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.giftCard.delete({
        where: { id: input.id },
      });
    }),
});
