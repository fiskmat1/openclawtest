import { z } from 'zod';

import { passwordValidator } from '@workspace/auth/password';

export const resetPasswordSchema = z.object({
  requestId: z.uuid('Request id is invalid.')
        .trim()
    .min(1, 'Request id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  password: z
    .string({
        error: (issue) => issue.input === undefined ? 'Password is required.' : 'Password must be a string.'
    })
    .min(1, 'Password is required.')
    .max(72, 'Maximum 72 characters allowed.')
    .refine((arg) => passwordValidator.validate(arg).success, {
        error: 'Password does not meet requirements.'
    })
});

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
