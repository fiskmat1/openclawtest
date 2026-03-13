import { z } from 'zod';

export const enableAuthenticatorAppSchema = z.object({
  accountName: z
    .string({
        error: (issue) => issue.input === undefined ? 'Account name is required.' : 'Account name must be a string.'
    })
    .trim()
    .min(1, 'Account name is required.')
    .max(255, `Maximum 255 characters allowed.`),
  issuer: z
    .string({
        error: (issue) => issue.input === undefined ? 'Issuer is required.' : 'Issuer must be a string.'
    })
    .trim()
    .min(1, 'Issuer is required.')
    .max(255, `Maximum 255 characters allowed.`),
  secret: z
    .string({
        error: (issue) => issue.input === undefined ? 'Secret is required.' : 'Secret must be a string.'
    })
    .trim()
    .min(1, 'Secret is required.')
    .max(32, `Maximum 32 characters allowed.`),
  totpCode: z
    .string({
        error: (issue) => issue.input === undefined ? 'Code is required.' : 'Code consists of 6 digits.'
    })
    .trim()
    .min(6, {
        error: ''
    })
});

export type EnableAuthenticatorAppSchema = z.infer<
  typeof enableAuthenticatorAppSchema
>;
