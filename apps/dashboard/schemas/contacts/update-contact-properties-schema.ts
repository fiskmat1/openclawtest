import { z } from 'zod';

import { ContactRecord } from '@workspace/database';

export const updateContactPropertiesSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  record: z.enum(ContactRecord, {
      error: (issue) => issue.input === undefined ? 'Record is required' : 'Record must be a string'
}),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Name is required.')
    .max(64, 'Maximum 64 characters allowed.'),
  email: z.email('Enter a valid email address.')
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
  address: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Address must be a string.'
    })
    .trim()
    .max(255, 'Maximum 255 characters allowed.')
    .optional()
    .or(z.literal(''))
});

export type UpdateContactPropertiesSchema = z.infer<
  typeof updateContactPropertiesSchema
>;
