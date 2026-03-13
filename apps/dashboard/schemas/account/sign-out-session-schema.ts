import { z } from 'zod';

export const signOutSessionSchema = z.object({
  id: z
    .string({
        error: (issue) => issue.input === undefined ? 'Id is required.' : 'Id must be a string.'
    })
    .trim()
    .min(1, 'Id is required.')
    .max(255, 'Maximum 255 characters allowed.')
});

export type SignOutSessionSchema = z.infer<typeof signOutSessionSchema>;
