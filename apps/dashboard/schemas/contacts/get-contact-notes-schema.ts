import { z } from 'zod';

export const getContactNotesSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .max(36, 'Maximum 36 characters allowed.')
});

export type GetContactNotesSchema = z.infer<typeof getContactNotesSchema>;
