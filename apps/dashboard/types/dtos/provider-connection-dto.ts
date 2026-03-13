import type {
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';

export type ProviderConnectionDto = {
  id: string;
  type: ProviderConnectionType;
  name: string;
  status: ProviderConnectionStatus;
  externalAccountId?: string;
  externalWorkspaceId?: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasSecret: boolean;
  lastVerifiedAt?: Date;
  updatedAt: Date;
};
