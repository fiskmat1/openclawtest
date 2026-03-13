import { literal, z } from 'zod';

import { WebhookTrigger } from '@workspace/database';

export const createWebhookSchema = z.object({
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
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Secret must be a string.'
    })
    .trim()
    .max(1024, 'Maximum 1024 characters allowed.')
    .optional()
    .or(literal(''))
});

export type CreateWebhookSchema = z.infer<typeof createWebhookSchema>;
