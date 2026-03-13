import { z } from 'zod';

import { passwordValidator } from '@workspace/auth/password';

export const signUpSchema = z.object({
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Name is required.')
    .max(64, 'Maximum 64 characters allowed.'),
  email: z.email('Enter a valid email address.')
      .trim()
      .min(1, 'Email is required.')
      .max(255, 'Maximum 255 characters allowed.'),
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

export type SignUpSchema = z.infer<typeof signUpSchema>;
