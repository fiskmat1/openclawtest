import { z } from 'zod';

export const updateContactNoteSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  text: z
    .string({
        error: (issue) => issue.input === undefined ? 'Text is required.' : 'Text must be a string.'
    })
    .trim()
    .min(1, 'Text is required.')
    .max(8000, 'Maximum 8000 characters allowed.')
});

export type UpdateContactNoteSchema = z.infer<typeof updateContactNoteSchema>;
