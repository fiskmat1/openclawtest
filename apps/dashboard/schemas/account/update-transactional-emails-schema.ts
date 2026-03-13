import { z } from 'zod';

export const updateTransactionalEmailsSchema = z.object({
  enabledContactsNotifications: z.boolean(),
  enabledInboxNotifications: z.boolean(),
  enabledWeeklySummary: z.boolean()
});

export type UpdateTransactionalEmailsSchema = z.infer<
  typeof updateTransactionalEmailsSchema
>;
