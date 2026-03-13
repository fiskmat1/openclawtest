import { z } from 'zod';

import { FileUploadAction } from '~/lib/file-upload';

export const updatePersonalDetailsSchema = z.object({
  action: z.enum(FileUploadAction, {
      error: (issue) => issue.input === undefined ? 'Action is required' : 'Action must be a string'
}),
  image: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Image must be a string.'
    })
    .optional()
    .or(z.literal('')),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Name is required.')
    .max(64, 'Maximum 64 characters allowed.'),
  phone: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Phone must be a string.'
    })
    .trim()
    .max(16, 'Maximum 16 characters allowed.')
    .optional()
    .or(z.literal(''))
});

export type UpdatePersonalDetailsSchema = z.infer<
  typeof updatePersonalDetailsSchema
>;
