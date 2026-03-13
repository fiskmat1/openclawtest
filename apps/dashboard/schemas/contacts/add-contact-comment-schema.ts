import { z } from 'zod';

export const addContactCommentSchema = z.object({
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
    .max(2000, 'Maximum 2000 characters allowed.')
});

export type AddContactCommentSchema = z.infer<typeof addContactCommentSchema>;
