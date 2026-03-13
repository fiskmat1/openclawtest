import { z } from 'zod';

export const updateMarketingEmailsSchema = z.object({
  enabledNewsletter: z.boolean(),
  enabledProductUpdates: z.boolean()
});

export type UpdateMarketingEmailsSchema = z.infer<
  typeof updateMarketingEmailsSchema
>;
