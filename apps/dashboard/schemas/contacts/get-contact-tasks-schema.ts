import { z } from 'zod';

export const getContactTasksSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .max(36, 'Maximum 36 characters allowed.')
});

export type GetContactTasksSchema = z.infer<typeof getContactTasksSchema>;
