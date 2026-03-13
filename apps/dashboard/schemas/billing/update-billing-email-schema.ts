import { z } from 'zod';

export const updateBillingEmailSchema = z.object({
  email: z.email('Enter a valid email address.')
        .trim()
        .max(255, 'Maximum 255 characters allowed.')
    .optional()
    .or(z.literal(''))
});

export type UpdateBillingEmailSchema = z.infer<typeof updateBillingEmailSchema>;
