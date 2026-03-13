import { z } from 'zod';

export const createApiKeySchema = z.object({
  description: z
    .string({
        error: (issue) => issue.input === undefined ? 'Description is required.' : 'Description must be a string.'
    })
    .trim()
    .min(1, 'Description is required.')
    .max(70, `Maximum 70 characters allowed.`),
  expiresAt: z.date().optional(),
  neverExpires: z.boolean()
});

export type CreateApiKeySchema = z.infer<typeof createApiKeySchema>;
