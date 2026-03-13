import { z } from 'zod';

import { OAuthProvider } from '@workspace/auth/providers.types';

export const disconnectAccountSchema = z.object({
  provider: z.enum(OAuthProvider, {
      error: (issue) => issue.input === undefined ? 'Provider is required' : 'Provider must be a string'
})
});

export type DisconnectAccountSchema = z.infer<typeof disconnectAccountSchema>;
