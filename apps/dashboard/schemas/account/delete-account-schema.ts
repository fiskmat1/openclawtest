import { z } from 'zod';

export const deleteAccountSchema = z.object({
  statement: z.boolean()
});

export type DeleteAccountSchema = z.infer<typeof deleteAccountSchema>;
