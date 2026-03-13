import type {
  BrowserProfileProvider,
  BrowserProfileStatus
} from '@workspace/database';

export type BrowserProfileDto = {
  id: string;
  name: string;
  provider: BrowserProfileProvider;
  status: BrowserProfileStatus;
  externalProfileId?: string;
  teamName?: string;
  saveChanges: boolean;
  managedAuth: boolean;
  lastSyncedAt?: Date;
};
