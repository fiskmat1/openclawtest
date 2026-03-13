import { z } from 'zod';

import { passwordValidator } from '@workspace/auth/password';

export const changePasswordSchema = z
  .object({
    hasPasswordSet: z.boolean(),
    currentPassword: z
      .string({
          error: (issue) => issue.input === undefined ? 'Password is required.' : 'Password must be a string.'
    })
      .min(1, 'Password is required.')
      .max(72, 'Maximum 72 characters allowed.')
      .optional()
      .or(z.literal('')),
    newPassword: z
      .string({
          error: (issue) => issue.input === undefined ? 'New password is required.' : 'New password must be a string.'
    })
      .min(1, 'New password is required.')
      .max(72, 'Maximum 72 characters allowed.')
      .refine((arg) => passwordValidator.validate(arg).success, {
          error: 'Password does not meet requirements.'
    }),
    verifyPassword: z
      .string({
          error: (issue) => issue.input === undefined ? 'Verify password is required.' : 'Verify password must be a string.'
    })
      .min(1, 'Verify password is required.')
      .max(72, 'Maximum 72 characters allowed.')
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.verifyPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords don't match.",
        path: ['confirmNewPassword']
      });
    }
    if (data.hasPasswordSet && !data.currentPassword) {
      ctx.addIssue({
        code: "custom",
        message: 'Current password is required.',
        path: ['currentPassword']
      });
    }
  });

export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
export type ChangePasswordField = keyof ChangePasswordSchema;
