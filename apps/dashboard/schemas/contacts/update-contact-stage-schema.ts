import { z } from 'zod';

import { ContactStage } from '@workspace/database';

export const updateContactStageSchema = z.object({
  id: z.uuid('Id is invalid.')
        .trim()
    .min(1, 'Id is required.')
    .max(36, 'Maximum 36 characters allowed.'),
  stage: z.enum(ContactStage, {
      error: (issue) => issue.input === undefined ? 'Stage is required' : 'Stage must be a string'
})
});

export type UpdateContactStageSchema = z.infer<typeof updateContactStageSchema>;
