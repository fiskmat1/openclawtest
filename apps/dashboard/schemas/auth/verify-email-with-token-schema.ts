import { z } from 'zod';

export const verifyEmailWithTokenSchema = z.object({
  token: z
    .string({
        error: (issue) => issue.input === undefined ? 'Token is required.' : 'Token must be a string.'
    })
    .trim()
    .min(1, 'Token is required.')
    .max(64, 'Maximum 64 characters allowed.')
});

export type VerifyEmailWithTokenSchema = z.infer<
  typeof verifyEmailWithTokenSchema
>;
