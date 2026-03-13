import { literal, z } from 'zod';

import { WebhookTrigger } from '@workspace/database';

export const updateWebhookSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  url: z.url('Enter a valid URL with schema.')
      .trim()
    .min(1, 'Webhook URL is required.')
    .max(2000, 'Maximum 2000 characters allowed.'),
  triggers: z.array(
    z.enum(WebhookTrigger, {
        error: (issue) => issue.input === undefined ? 'Trigger is required' : 'Trigger must be a string'
    })
  ),
  secret: z
    .string()
    .trim()
    .max(1024, 'Maximum 1024 characters allowed.')
    .optional()
    .or(literal(''))
});

export type UpdateWebhookSchema = z.infer<typeof updateWebhookSchema>;
