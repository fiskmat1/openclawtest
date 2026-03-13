import { z } from 'zod';

export const logInSchema = z.object({
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
});

export type LoginSchema = z.infer<typeof logInSchema>;

export const submitTotpCodeSchema = z.object({
  token: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Token must be a string.'
    })
    .trim()
    .min(1, 'Token is required.')
    .max(255, 'Maximum 255 characters allowed.'),
  expiry: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Expiry must be a string.'
    })
    .trim()
    .min(1, 'Expiry is required.')
    .max(255, 'Maximum 255 characters allowed.'),
  totpCode: z
    .string({
        error: (issue) => issue.input === undefined ? 'Code is required.' : 'Code consists of 6 digits.'
    })
    .trim()
    .max(6, {
        error: ''
    })
});

export type SubmitTotpCodeSchema = z.infer<typeof submitTotpCodeSchema>;

export const submitRecoveryCodeSchema = z.object({
  token: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Token must be a string.'
    })
    .trim()
    .min(1, 'Token is required.')
    .max(255, 'Maximum 255 characters allowed.'),
  expiry: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Expiry must be a string.'
    })
    .trim()
    .min(1, 'Expiry is required.')
    .max(255, 'Maximum 255 characters allowed.'),
  recoveryCode: z
    .string({
        error: (issue) => issue.input === undefined ? 'Recovery code is required.' : 'Recovery code must be a string.'
    })
    .trim()
    .min(1, 'Recovery code is required.')
    .max(11, 'Maximum 11 characters allowed.')
});

export type SubmitRecoveryCodeSchema = z.infer<typeof submitRecoveryCodeSchema>;
