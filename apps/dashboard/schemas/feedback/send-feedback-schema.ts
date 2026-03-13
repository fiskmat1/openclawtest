import { z } from 'zod';

import { FeedbackCategory } from '@workspace/database';

export const sendFeedbackSchema = z.object({
  category: z.enum(FeedbackCategory, {
      error: (issue) => issue.input === undefined ? 'Category is required' : 'Cateogry must be a string'
}),
  message: z
    .string({
        error: (issue) => issue.input === undefined ? 'Message is required.' : 'Message must be a string.'
    })
    .trim()
    .min(1, 'Message is required.')
    .max(4000, `Maximum 4000 characters allowed.`)
});

export type SendFeedbackSchema = z.infer<typeof sendFeedbackSchema>;
