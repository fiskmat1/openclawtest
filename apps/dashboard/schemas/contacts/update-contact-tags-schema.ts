import { z } from 'zod';

export const updateContactTagsSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  tags: z.array(
    z.object({
      id: z.string(),
      text: z
        .string({
            error: (issue) => issue.input === undefined ? 'Tag is required.' : 'Tag must be a string.'
        })
        .trim()
        .min(1, 'Tag is required.')
        .max(200, 'Maximum 200 characters allowed.')
    })
  )
});

export type UpdateContactTagsSchema = z.infer<typeof updateContactTagsSchema>;
