import { z } from 'zod';

import { Role } from '@workspace/database';

import { FileUploadAction } from '~/lib/file-upload';

export const profileOnboardingSchema = z.object({
  action: z.enum(FileUploadAction, {
      error: (issue) => issue.input === undefined ? 'Action is required' : 'Action must be a string'
}),
  image: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Image must be a string.'
    })
    .optional()
    .or(z.literal('')),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Name is required.')
    .max(64, 'Maximum 64 characters allowed.'),
  phone: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Phone must be a string.'
    })
    .trim()
    .max(16, 'Maximum 16 characters allowed.')
    .optional()
    .or(z.literal('')),
  // We are not using the email on the server
  email: z.string().optional().or(z.literal(''))
});

export const themeOnboardingSchema = z.object({
  theme: z.literal('light').or(z.literal('dark').or(z.literal('system')))
});

export const organizationOnboardingSchema = z.object({
  logo: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Logo must be a string.'
    })
    .optional()
    .or(z.literal('')),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'Name is required.' : 'Name must be a string.'
    })
    .trim()
    .min(1, 'Name is required.')
    .max(64, 'Maximum 64 characters allowed.'),
  slug: z
    .string({
        error: (issue) => issue.input === undefined ? 'Slug is required.' : 'Slug must be a string.'
    })
    .trim()
    .min(3, 'Minimum 3 characters required.')
    .max(1024, 'Maximum 1024 characters allowed.')
    .regex(/^[a-z0-9]+[a-z0-9_-]*[a-z0-9]+$/, {
        error: 'Slug must start and end with a letter or number and can contain underscores and hyphens in between.'
    }),
  addExampleData: z.boolean()
});

export const inviteTeamOnboardingSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: z.email('Enter a valid email address.')
                    .trim()
                    .max(255, 'Maximum 255 characters allowed.')
          .optional()
          .or(z.literal('')),
        role: z.enum(Role, {
            error: (issue) => issue.input === undefined ? 'Role is required' : 'Role must be a string'
        })
      })
    )
    .max(5, 'Maximum 5 invitations allowed.')
    .optional()
});

export const pendingInvitationsOnboardingSchema = z.object({
  invitationIds: z.array(
    z.uuid('Id is invalid.')
            .trim()
      .min(1, 'Id is required.')
      .max(36, 'Maximum 36 characters allowed.')
  )
});

export enum OnboardingStep {
  Profile = 'profile',
  Theme = 'theme',
  Organization = 'organization',
  InviteTeam = 'invite-team',
  PendingInvitations = 'pending-invitations'
}

export const completeOnboardingSchema = z.object({
  activeSteps: z.array(z.enum(OnboardingStep)),
  profileStep: profileOnboardingSchema.optional(),
  themeStep: themeOnboardingSchema.optional(),
  organizationStep: organizationOnboardingSchema.optional(),
  inviteTeamStep: inviteTeamOnboardingSchema.optional(),
  pendingInvitationsStep: pendingInvitationsOnboardingSchema.optional()
});

export type CompleteOnboardingSchema = z.infer<typeof completeOnboardingSchema>;
