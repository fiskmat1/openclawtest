import { z } from 'zod';

export const getContactIsInFavoritesSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .max(36, 'Maximum 36 characters allowed.')
});

export type GetContactAddedToFavoritesSchema = z.infer<
  typeof getContactIsInFavoritesSchema
>;
