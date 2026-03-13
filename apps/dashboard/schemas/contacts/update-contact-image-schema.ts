import { z } from 'zod';

import { FileUploadAction } from '~/lib/file-upload';

export const updateContactImageSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  action: z.enum(FileUploadAction, {
      error: (issue) => issue.input === undefined ? 'Action is required' : 'Action must be a string'
}),
  image: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Image must be a string.'
    })
    .optional()
    .or(z.literal(''))
});

export type UpdateContactImageSchema = z.infer<typeof updateContactImageSchema>;
