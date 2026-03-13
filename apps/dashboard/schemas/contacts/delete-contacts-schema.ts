import { z } from 'zod';

export const deleteContactsSchema = z.object({
  ids: z.array(
    z.uuid('Id is invalid.')
            .trim()
      .min(1, 'Id is required.')
      .max(36, 'Maximum 36 characters allowed.')
  )
});

export type DeleteContactsSchema = z.infer<typeof deleteContactsSchema>;
