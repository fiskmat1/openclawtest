import { z } from 'zod';

import { FileUploadAction } from '~/lib/file-upload';

export const updateOrganizationLogoSchema = z.object({
  action: z.enum(FileUploadAction),
  logo: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Logo must be a string.'
    })
    .optional()
    .or(z.literal(''))
});

export type UpdateOrganizationLogoSchema = z.infer<
  typeof updateOrganizationLogoSchema
>;
