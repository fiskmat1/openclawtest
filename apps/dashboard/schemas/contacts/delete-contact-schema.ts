import { z } from 'zod';

export const deleteContactSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type DeleteContactSchema = z.infer<typeof deleteContactSchema>;
