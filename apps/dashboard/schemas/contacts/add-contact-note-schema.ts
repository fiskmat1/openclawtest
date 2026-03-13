import { z } from 'zod';

export const addContactNoteSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .min(1, 'Contact id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  text: z
    .string({
        error: (issue) => issue.input === undefined ? 'Text is required.' : 'Text must be a string.'
    })
    .trim()
    .min(1, 'Text is required.')
    .max(8000, 'Maximum 8000 characters allowed.')
    .optional()
    .or(z.literal(''))
});

export type AddContactNoteSchema = z.infer<typeof addContactNoteSchema>;
