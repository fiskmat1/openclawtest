import { z } from 'zod';

export const resolveApprovalRequestSchema = z.object({
  id: z.uuid(),
  approved: z.boolean(),
  decisionReason: z.string().trim().max(2000).optional()
});

export type ResolveApprovalRequestSchema = z.infer<
  typeof resolveApprovalRequestSchema
>;
