import { z } from 'zod';

export const getContactSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type GetContactSchema = z.infer<typeof getContactSchema>;
