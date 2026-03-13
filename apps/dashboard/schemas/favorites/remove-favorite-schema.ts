import { z } from 'zod';

export const removeFavoriteSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .min(1, 'Contact id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type RemoveFavoriteSchema = z.infer<typeof removeFavoriteSchema>;
