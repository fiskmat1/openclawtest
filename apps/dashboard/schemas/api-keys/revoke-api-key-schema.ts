import { z } from 'zod';

export const revokeApiKeySchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type RevokeApiKeySchema = z.infer<typeof revokeApiKeySchema>;
