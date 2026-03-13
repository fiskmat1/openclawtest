import { AuthErrorCode } from '@workspace/auth/errors';
import { Provider } from '@workspace/auth/providers.types';

// Define enum values as string literals to avoid importing @prisma/client in client components
// These values must match the Prisma schema enum mappings

type ContactStage =
  | 'LEAD'
  | 'QUALIFIED'
  | 'OPPORTUNITY'
  | 'PROPOSAL'
  | 'IN_NEGOTIATION'
  | 'LOST'
  | 'WON';

type ContactRecord = 'PERSON' | 'COMPANY';

type Role = 'MEMBER' | 'ADMIN';

type FeedbackCategory = 'SUGGESTION' | 'PROBLEM' | 'QUESTION';

type WebhookTrigger =
  | 'CONTACT_CREATED'
  | 'CONTACT_UPDATED'
  | 'CONTACT_DELETED';

export const contactStageLabel: Record<ContactStage, string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Qualified',
  OPPORTUNITY: 'Opportunity',
  PROPOSAL: 'Proposal',
  IN_NEGOTIATION: 'In negotiation',
  LOST: 'Lost',
  WON: 'Won'
};

export const contactRecordLabel: Record<ContactRecord, string> = {
  PERSON: 'Person',
  COMPANY: 'Company'
};

export const roleLabels: Record<Role, string> = {
  MEMBER: 'Member',
  ADMIN: 'Admin'
};

export const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  SUGGESTION: 'Suggestion',
  PROBLEM: 'Problem',
  QUESTION: 'Question'
};

export const webhookTriggerLabels: Record<WebhookTrigger, string> = {
  CONTACT_CREATED: 'Contact created',
  CONTACT_UPDATED: 'Contact updated',
  CONTACT_DELETED: 'Contact deleted'
};

export const identityProviderLabels: Record<Provider, string> = {
  [Provider.Credentials]: 'Credentials',
  [Provider.TotpCode]: 'TOTP code',
  [Provider.RecoveryCode]: 'Recovery code',
  [Provider.Google]: 'Google',
  [Provider.MicrosoftEntraId]: 'Microsoft'
};

export const authErrorLabels: Record<AuthErrorCode, string> = {
  [AuthErrorCode.NewEmailConflict]: 'Email already exists.',
  [AuthErrorCode.UnverifiedEmail]: 'Email is not verified.',
  [AuthErrorCode.IncorrectEmailOrPassword]: 'Email or password is not correct.',
  [AuthErrorCode.TotpCodeRequired]: 'TOTP code is required.',
  [AuthErrorCode.IncorrectTotpCode]: 'The TOTP code is not correct.',
  [AuthErrorCode.MissingRecoveryCodes]: 'Missing recovery codes.',
  [AuthErrorCode.IncorrectRecoveryCode]: 'The recovery code is not correct.',
  [AuthErrorCode.RequestExpired]: 'Request has expired.',
  [AuthErrorCode.RateLimitExceeded]: 'Rate limit exceeded.',
  [AuthErrorCode.IllegalOAuthProvider]: 'Illegal OAuth provider.',
  [AuthErrorCode.InternalServerError]:
    'Something went wrong. Please try again later.',
  [AuthErrorCode.MissingOAuthEmail]: 'Missing OAuth email.',
  [AuthErrorCode.AlreadyLinked]: 'OAuth account has been already linked.',
  [AuthErrorCode.RequiresExplicitLinking]:
    'Please sign in first to link this account',
  [AuthErrorCode.UnknownError]: 'Unknown error.'
};
