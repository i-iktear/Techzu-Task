const { z } = require('zod');

const createOutletSchema = z.object({
  name: z.string().min(1).max(120),
});

const createMenuItemSchema = z.object({
  name: z.string().min(1).max(150),
  basePrice: z.number().nonnegative(),
});

const assignMenuItemSchema = z.object({
  menuItemId: z.number().int().positive(),
  priceOverride: z.number().nonnegative().nullable().optional(),
});

const setStockSchema = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().nonnegative(),
});

const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

module.exports = {
  createOutletSchema,
  createMenuItemSchema,
  assignMenuItemSchema,
  setStockSchema,
  createSaleSchema,
};
