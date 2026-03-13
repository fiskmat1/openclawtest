import { z } from 'zod';

export const requestEmailChangeSchema = z.object({
  email: z.email('Enter a valid email address.')
        .trim()
        .min(1, 'Email is required.')
        .max(255, 'Maximum 255 characters allowed.')
});

export type RequestEmailChangeSchema = z.infer<typeof requestEmailChangeSchema>;
