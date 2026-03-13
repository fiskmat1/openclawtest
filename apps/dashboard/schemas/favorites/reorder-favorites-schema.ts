import { z } from 'zod';

export const reorderFavoritesSchema = z.object({
  favorites: z.array(
    z.object({
      id: z.uuid('Id is invalid.')
                .trim()
        .min(1, 'Id is required.')
        .max(36, 'Maximum 36 characters allowed.'),
      order: z.coerce.number().int().min(0)
    })
  )
});

export type ReorderFavoritesSchema = z.infer<typeof reorderFavoritesSchema>;
