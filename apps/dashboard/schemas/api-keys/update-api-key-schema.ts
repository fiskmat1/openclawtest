import { z } from 'zod';

export const updateApiKeySchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
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

export type UpdateApiKeySchema = z.infer<typeof updateApiKeySchema>;
