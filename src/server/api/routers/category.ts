import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const categoryRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      orderBy: { name: "asc" },
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
      return ctx.db.category.create({
        data: { name: input.name },
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

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.delete({
        where: { id: input.id },
      });
    }),
});
