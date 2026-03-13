import { z } from 'zod';

import { Role } from '@workspace/database';

export const sendInvitationSchema = z.object({
  email: z.email('Enter a valid email address.')
        .trim()
        .min(1, 'Email is required.')
        .max(255, 'Maximum 255 characters allowed.'),
  role: z.enum(Role, {
      error: (issue) => issue.input === undefined ? 'Role is required' : 'Role must be a string'
})
});

export type SendInvitationSchema = z.infer<typeof sendInvitationSchema>;
