import { z } from 'zod';

export const acceptInvitationSchema = z.object({
  invitationId: z.uuid('Invitation id is invalid.')
        .trim()
    .min(1, 'Invitation id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type AcceptInvitationSchema = z.infer<typeof acceptInvitationSchema>;
