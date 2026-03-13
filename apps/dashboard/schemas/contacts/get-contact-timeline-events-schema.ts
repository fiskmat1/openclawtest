import { z } from 'zod';

export const getContactTimelineEventsSchema = z.object({
  contactId: z.uuid('Contact id is invalid.')
        .trim()
    .max(36, 'Maximum 36 characters allowed.')
});

export type GetContactTimelineEventsSchema = z.infer<
  typeof getContactTimelineEventsSchema
>;
