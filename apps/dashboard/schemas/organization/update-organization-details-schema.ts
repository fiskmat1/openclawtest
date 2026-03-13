import { z } from 'zod';

export const updateOrganizationDetailsSchema = z.object({
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Organization name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Organization name is required.')
    .max(255, 'Maximum 255 characters allowed.'),
  address: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Address must be a string.'
    })
    .trim()
    .max(255, 'Maximum 255 characters allowed.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Phone must be a string.'
    })
    .trim()
    .max(16, 'Maximum 16 characters allowed.')
    .optional()
    .or(z.literal('')),
  email: z.email('Enter a valid email address.')
      .trim()
      .max(255, 'Maximum 255 characters allowed.')
    .optional()
    .or(z.literal('')),
  website: z.url('Enter a valid URL with schema.')
      .trim()
    .max(2000, 'Maximum 2000 characters allowed.')
    .optional()
    .or(z.literal(''))
});

export type UpdateOrganizationDetailsSchema = z.infer<
  typeof updateOrganizationDetailsSchema
>;
