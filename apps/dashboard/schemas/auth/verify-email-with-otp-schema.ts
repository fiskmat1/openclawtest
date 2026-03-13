import { z } from 'zod';

export const verifyEmailWithOtpSchema = z.object({
  otp: z
    .string({
        error: (issue) => issue.input === undefined ? 'OTP is required.' : 'OTP must be a string.'
    })
    .trim()
    .min(1, 'OTP is required.')
    .max(6, 'Maximum 6 characters allowed.')
});

export type VerifyEmailWithOtpSchema = z.infer<typeof verifyEmailWithOtpSchema>;
