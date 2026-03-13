import { z } from 'zod';

import { Role } from '@workspace/database';

export const updateInvitationSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  role: z.enum(Role, {
      error: (issue) => issue.input === undefined ? 'Role is required' : 'Role must be a string'
})
});

export type UpdateInvitationSchema = z.infer<typeof updateInvitationSchema>;
