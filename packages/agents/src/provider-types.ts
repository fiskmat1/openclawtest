import type {
  AgentDeploymentStatus,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  ApprovalRequestKind,
  BrowserProfileStatus,
  ProviderConnectionType
} from '@workspace/database';

export type SecretRef = {
  encryptedValue?: string;
  plainTextValue?: string;
};

export type RuntimeProvisionInput = {
  organizationId: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  preferredRegion?: string;
  model?: string;
  providerConnection?: {
    id: string;
    type: ProviderConnectionType;
    encryptedAccessToken?: string | null;
    encryptedRefreshToken?: string | null;
    encryptedSecret?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  metadata?: Record<string, unknown>;
};

export type RuntimeSyncResult = {
  provider: AgentRuntimeProvider;
  deploymentStatus: AgentDeploymentStatus;
  runtimeStatus: AgentRuntimeStatus;
  externalDeploymentId?: string;
  externalRuntimeId?: string;
  controlUrl?: string;
  gatewayUrl?: string;
  region?: string;
  machineClass?: string;
  metadata?: Record<string, unknown>;
};

export type GatewaySession = {
  key: string;
  title: string;
  kind?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type SpawnGatewaySessionInput = {
  teamSlug: string;
  title: string;
  prompt: string;
  metadata?: Record<string, unknown>;
};

export type SendGatewayMessageInput = {
  sessionKey: string;
  message: string;
  timeoutMs?: number;
};

export type GatewayTranscriptEntry = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type BrowserProfileInput = {
  organizationId: string;
  teamId?: string;
  name: string;
  externalProfileId?: string;
  managedAuth?: boolean;
  saveChanges?: boolean;
  metadata?: Record<string, unknown>;
};

export type BrowserProfileResult = {
  externalProfileId?: string;
  liveViewUrl?: string;
  status: BrowserProfileStatus;
  metadata?: Record<string, unknown>;
};

export type PublishVideoInput = {
  accessToken: string;
  title: string;
  videoUrl?: string;
  fileUpload?: {
    contentType: 'video/mp4' | 'video/quicktime' | 'video/webm';
    totalBytes: number;
    chunkSize: number;
    totalChunkCount: number;
  };
  source: 'PULL_FROM_URL' | 'FILE_UPLOAD';
  directPost?: boolean;
  runId?: string;
  artifactId?: string;
  metadata?: Record<string, unknown>;
};

export type PublishVideoResult = {
  publishId: string;
  uploadUrl?: string;
  status: AgentRunStatus;
  metadata?: Record<string, unknown>;
};

export type PublishVideoStatus = {
  publishId: string;
  status: AgentRunStatus;
  postId?: string;
  metadata?: Record<string, unknown>;
};

export type ApprovalRequestPayload = {
  kind: ApprovalRequestKind;
  title: string;
  description?: string;
  payload: Record<string, unknown>;
};

export interface RuntimeProviderClient {
  createRuntime(input: RuntimeProvisionInput): Promise<RuntimeSyncResult>;
  syncRuntime(
    input: RuntimeProvisionInput & { externalRuntimeId?: string }
  ): Promise<RuntimeSyncResult>;
}

export interface OpenClawGatewayClient {
  listSessions(): Promise<GatewaySession[]>;
  spawnSession(input: SpawnGatewaySessionInput): Promise<GatewaySession>;
  sendMessage(input: SendGatewayMessageInput): Promise<{ ok: true }>;
  getHistory(sessionKey: string): Promise<GatewayTranscriptEntry[]>;
}

export interface BrowserProfileProviderClient {
  createProfile(input: BrowserProfileInput): Promise<BrowserProfileResult>;
  syncProfile(input: BrowserProfileInput): Promise<BrowserProfileResult>;
}

export interface SocialPublisherClient {
  publishVideo(input: PublishVideoInput): Promise<PublishVideoResult>;
  getPublishStatus(
    publishId: string,
    accessToken: string
  ): Promise<PublishVideoStatus>;
}

export type TelegramWebhookInput = {
  accessToken: string;
  webhookUrl: string;
  secretToken: string;
};

export type TelegramSendMessageInput = {
  accessToken: string;
  chatId: string;
  text: string;
  threadId?: string;
  disableNotification?: boolean;
};

export interface TelegramBotClient {
  setWebhook(input: TelegramWebhookInput): Promise<{ ok: true }>;
  sendMessage(input: TelegramSendMessageInput): Promise<{
    ok: true;
    messageId?: string;
  }>;
}
