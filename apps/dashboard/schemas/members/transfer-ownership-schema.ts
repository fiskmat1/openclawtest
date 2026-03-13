import { z } from 'zod';

export const transferOwnershipSchema = z.object({
  targetId: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.')
});

export type TransferOwnershipSchema = z.infer<typeof transferOwnershipSchema>;
