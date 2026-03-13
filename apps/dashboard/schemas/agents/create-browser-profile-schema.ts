import { z } from 'zod';

export const createBrowserProfileSchema = z.object({
  providerConnectionId: z.uuid(),
  teamId: z.uuid().optional(),
  name: z.string().trim().min(2).max(255),
  managedAuth: z.boolean().default(false),
  saveChanges: z.boolean().default(true)
});

export type CreateBrowserProfileSchema = z.infer<
  typeof createBrowserProfileSchema
>;
