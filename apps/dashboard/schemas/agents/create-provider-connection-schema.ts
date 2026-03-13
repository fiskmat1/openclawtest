import { z } from 'zod';

import { ProviderConnectionType } from '@workspace/database';

export const createProviderConnectionSchema = z.object({
  type: z.enum(ProviderConnectionType),
  name: z.string().trim().min(2).max(255),
  accessToken: z.string().trim().max(8000).optional(),
  refreshToken: z.string().trim().max(8000).optional(),
  secret: z.string().trim().max(8000).optional(),
  externalAccountId: z.string().trim().max(255).optional(),
  externalWorkspaceId: z.string().trim().max(255).optional(),
  metadataJson: z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) {
        return true;
      }

      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null;
      } catch {
        return false;
      }
    }, 'Metadata must be valid JSON.')
});

export type CreateProviderConnectionSchema = z.infer<
  typeof createProviderConnectionSchema
>;
