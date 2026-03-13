import { z } from 'zod';

export const deleteInvitationSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type DeleteInvitationSchema = z.infer<typeof deleteInvitationSchema>;
