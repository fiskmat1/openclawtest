import { z } from 'zod';

export const getLeadGenerationDataSchema = z
  .object({
    from: z.coerce.date({
        error: (issue) => issue.input === undefined ? 'From date is required.' : 'From must be a valid date.'
    }),
    to: z.coerce.date({
        error: (issue) => issue.input === undefined ? 'To date is required.' : 'From must be a valid date.'
    })
  })
  .refine((data) => data.from <= data.to, {
    path: ['from'],
      error: 'From date must be earlier than or equal to To date'
});

export type GetLeadGenerationDataSchema = z.infer<
  typeof getLeadGenerationDataSchema
>;
