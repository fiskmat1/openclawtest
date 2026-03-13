import { z } from 'zod';

export enum PriceInterval {
  Month = 'month',
  Year = 'year'
}

export enum PriceType {
  Recurring = 'recurring',
  OneTime = 'one-time'
}

export enum PriceModel {
  Flat = 'flat',
  PerSeat = 'per_seat',
  Metered = 'metered'
}

const tierSchema = z.object({
  upTo: z.number().min(0),
  cost: z.number().min(0)
});

const priceSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(PriceType),
    model: z.enum(PriceModel),
    interval: z.enum(PriceInterval).optional(),
    currency: z.string().min(3).max(3),
    cost: z.number().min(0),
    meter: z
      .object({
        id: z.string().optional(),
        unit: z.string().min(1),
        tiers: z.array(tierSchema)
      })
      .optional()
  })
  .refine(
    (data) => data.type !== PriceType.OneTime || data.interval === undefined,
    {
      path: ['type', 'interval'],
        error: 'One-time prices must not have an interval'
    }
  )
  .refine(
    (data) => data.type !== PriceType.Recurring || data.interval !== undefined,
    {
      path: ['type', 'interval'],
        error: 'Recurring prices must have an interval'
    }
  )
  .refine(
    (data) => data.type !== PriceType.OneTime || data.model === PriceModel.Flat,
    {
      path: ['type', 'model'],
        error: 'One-time prices must have a flat price model'
    }
  )
  .refine(
    (data) => data.model !== PriceModel.Metered || data.meter !== undefined,
    {
      path: ['model', 'meter'],
        error: 'Metered price models must have a meter'
    }
  )
  .refine((data) => data.model !== PriceModel.Metered || data.cost === 0, {
    path: ['model', 'cost'],
      error: 'Metered prices must have a cost of 0. Please add a different price for a flat fee (Stripe)'
});

const planSchema = z.object({
  id: z.string().min(1),
  displayIntervals: z.array(z.enum(PriceInterval)),
  trialDays: z.number().positive().optional(),
  prices: z.tuple([priceSchema], priceSchema)
    .refine(
      (prices) => {
        const models = prices.map((price) => price.model);
        const perSeat = models.filter(
          (model) => model === PriceModel.PerSeat
        ).length;
        const flat = models.filter((type) => type === PriceModel.Flat).length;
        return perSeat <= 1 && flat <= 1;
      },
      {
        path: ['prices'],
          error: 'Plans can only have one per-seat and one flat price'
    }
    )
});

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  label: z.string().min(1),
  enableDiscounts: z.boolean().optional(),
  recommended: z.boolean().optional(),
  hidden: z.boolean().optional(),
  isFree: z.boolean().optional(),
  isEnterprise: z.boolean().optional(),
  features: z.array(z.string()),
  plans: z.tuple([planSchema], planSchema)
    .refine(
      (plans) => {
        const counts = new Map<string, number>();
        for (const plan of plans) {
          for (const interval of plan.displayIntervals) {
            counts.set(interval, (counts.get(interval) ?? 0) + 1);
            if (counts.get(interval)! > 1) {
              return false;
            }
          }
        }
        return true;
      },
      {
        path: ['plans'],
          error: "Each displayInterval (e.g. 'Month', 'Year') can appear in at most one plan."
    }
    )
});

const billingConfigSchema = z
  .object({
    products: z.tuple([productSchema], productSchema)
  })
  .refine(
    (data) => {
      const ids = data.products.flatMap((product) =>
        product.plans.map((price) => price.id)
      );
      return ids.length === new Set(ids).size;
    },
    {
      path: ['products'],
        error: 'Price IDs must be unique'
    }
  );

export function createBillingConfig(config: BillingConfig): BillingConfig {
  return billingConfigSchema.parse(config);
}

export type BillingConfig = z.infer<typeof billingConfigSchema>;
export type Product = z.infer<typeof productSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Price = z.infer<typeof priceSchema>;
export type Tier = z.infer<typeof tierSchema>;
