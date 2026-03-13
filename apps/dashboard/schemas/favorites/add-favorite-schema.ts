import { z } from 'zod';

export const addFavoriteSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .min(1, 'Contact id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type AddFavoriteSchema = z.infer<typeof addFavoriteSchema>;
