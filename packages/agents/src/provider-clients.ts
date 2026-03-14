import { Sandbox } from '@e2b/desktop';

import {
  AgentDeploymentStatus,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  BrowserProfileStatus,
  ProviderConnectionType
} from '@workspace/database';

import { keys } from '../keys';
import { decryptSecret } from './encryption';
import type {
  BrowserProfileInput,
  BrowserProfileProviderClient,
  BrowserProfileResult,
  GatewaySession,
  GatewayTranscriptEntry,
  OpenClawGatewayClient,
  PublishVideoInput,
  PublishVideoResult,
  PublishVideoStatus,
  RuntimeProviderClient,
  RuntimeProvisionInput,
  RuntimeSyncResult,
  SendGatewayMessageInput,
  SocialPublisherClient,
  SpawnGatewaySessionInput,
  TelegramBotClient,
  TelegramSendMessageInput,
  TelegramWebhookInput
} from './provider-types';

type JsonRecord = Record<string, unknown>;

function createJsonHeaders(
  token?: string,
  additional: Record<string, string> = {}
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...additional
  };
}

async function fetchJson<TResponse>(
  input: string,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Request failed with status ${response.status}: ${body || response.statusText}`
    );
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  return (await response.json()) as TResponse;
}

function getProviderConnectionMetadata(
  input: Pick<RuntimeProvisionInput, 'providerConnection' | 'metadata'>
): JsonRecord {
  return {
    ...((input.providerConnection?.metadata as JsonRecord | null) ?? {}),
    ...((input.metadata as JsonRecord | undefined) ?? {})
  };
}

function getStringValue(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumberValue(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getBooleanValue(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  return undefined;
}

function getResolutionValue(record: JsonRecord): [number, number] | undefined {
  const resolution = record.resolution;

  if (
    Array.isArray(resolution) &&
    resolution.length === 2 &&
    typeof resolution[0] === 'number' &&
    typeof resolution[1] === 'number'
  ) {
    return [resolution[0], resolution[1]];
  }

  const width = getNumberValue(record, 'width');
  const height = getNumberValue(record, 'height');

  if (!width || !height) {
    return undefined;
  }

  return [width, height];
}

async function getProviderToken(
  input: RuntimeProvisionInput,
  provider: ProviderConnectionType
): Promise<string | undefined> {
  if (input.providerConnection?.type !== provider) {
    return undefined;
  }

  if (input.providerConnection.encryptedAccessToken) {
    return decryptSecret(input.providerConnection.encryptedAccessToken);
  }

  return getStringValue(getProviderConnectionMetadata(input), 'accessToken');
}

async function getProviderSecret(
  input: RuntimeProvisionInput,
  provider: ProviderConnectionType
): Promise<string | undefined> {
  if (input.providerConnection?.type !== provider) {
    return undefined;
  }

  if (input.providerConnection.encryptedSecret) {
    return decryptSecret(input.providerConnection.encryptedSecret);
  }

  return getStringValue(getProviderConnectionMetadata(input), 'secret');
}

function buildE2BSandboxMetadata(
  input: RuntimeProvisionInput
): Record<string, string> {
  return {
    organizationId: input.organizationId,
    teamId: input.teamId,
    teamName: input.teamName,
    teamSlug: input.teamSlug
  };
}

function mapKiloSyncResult(
  input: RuntimeProvisionInput,
  response: JsonRecord
): RuntimeSyncResult {
  return {
    provider: AgentRuntimeProvider.KILOCLAW,
    deploymentStatus:
      (response.status as AgentDeploymentStatus | undefined) ??
      AgentDeploymentStatus.PROVISIONING,
    runtimeStatus:
      (response.runtimeStatus as AgentRuntimeStatus | undefined) ??
      AgentRuntimeStatus.PENDING,
    externalDeploymentId:
      (response.deploymentId as string | undefined) ??
      (response.id as string | undefined),
    externalRuntimeId:
      (response.runtimeId as string | undefined) ??
      (response.id as string | undefined),
    controlUrl: response.controlUrl as string | undefined,
    gatewayUrl: response.gatewayUrl as string | undefined,
    region: (response.region as string | undefined) ?? input.preferredRegion,
    machineClass: response.machineClass as string | undefined,
    metadata: response
  };
}

export function createKiloClawProviderClient(): RuntimeProviderClient {
  const env = keys();

  return {
    async createRuntime(input) {
      const apiKey =
        env.AGENTS_KILO_API_KEY ||
        (await getProviderToken(input, ProviderConnectionType.KILO));

      const requestBody =
        input.metadata?.requestBody &&
        typeof input.metadata.requestBody === 'object'
          ? (input.metadata.requestBody as JsonRecord)
          : {
              name: input.teamName,
              slug: input.teamSlug,
              region: input.preferredRegion,
              metadata: input.metadata ?? {}
            };

      const response = await fetchJson<JsonRecord>(
        `${env.AGENTS_KILO_API_BASE_URL}/api/instance`,
        {
          method: 'POST',
          headers: createJsonHeaders(apiKey),
          body: JSON.stringify(requestBody)
        }
      );

      return mapKiloSyncResult(input, response);
    },
    async syncRuntime(input) {
      const apiKey =
        env.AGENTS_KILO_API_KEY ||
        (await getProviderToken(input, ProviderConnectionType.KILO));

      if (!input.metadata?.statusEndpoint) {
        return {
          provider: AgentRuntimeProvider.KILOCLAW,
          deploymentStatus: AgentDeploymentStatus.PROVISIONING,
          runtimeStatus: AgentRuntimeStatus.PENDING,
          externalRuntimeId: input.metadata?.externalRuntimeId as
            | string
            | undefined,
          metadata: input.metadata
        };
      }

      const response = await fetchJson<JsonRecord>(
        String(input.metadata.statusEndpoint),
        {
          method: 'GET',
          headers: createJsonHeaders(apiKey)
        }
      );

      return mapKiloSyncResult(input, response);
    }
  };
}

function buildE2BRuntimeMetadata(
  input: RuntimeProvisionInput,
  args: {
    sandboxId: string;
    controlUrl?: string;
    streamAuthKey?: string;
    template?: string;
    timeoutMs: number;
    resolution?: [number, number];
    dpi?: number;
    state?: string;
    gatewayUrl?: string;
  }
): JsonRecord {
  return {
    ...getProviderConnectionMetadata(input),
    sandboxId: args.sandboxId,
    controlUrl: args.controlUrl,
    streamAuthKey: args.streamAuthKey,
    template: args.template,
    timeoutMs: args.timeoutMs,
    resolution: args.resolution,
    dpi: args.dpi,
    state: args.state,
    gatewayUrl: args.gatewayUrl
  };
}

function getE2BTemplate(input: RuntimeProvisionInput): string | undefined {
  const env = keys();
  return (
    getStringValue(getProviderConnectionMetadata(input), 'template') ||
    env.AGENTS_E2B_TEMPLATE
  );
}

function getE2BTimeoutMs(input: RuntimeProvisionInput): number {
  const env = keys();
  return (
    getNumberValue(getProviderConnectionMetadata(input), 'timeoutMs') ??
    env.AGENTS_E2B_TIMEOUT_MS ??
    300_000
  );
}

function getE2BDpi(input: RuntimeProvisionInput): number | undefined {
  return getNumberValue(getProviderConnectionMetadata(input), 'dpi');
}

function getE2BResolution(
  input: RuntimeProvisionInput
): [number, number] | undefined {
  return getResolutionValue(getProviderConnectionMetadata(input));
}

function getE2BGatewayUrl(input: RuntimeProvisionInput): string | undefined {
  const env = keys();
  return (
    getStringValue(
      getProviderConnectionMetadata(input),
      'openClawRpcEndpoint'
    ) ||
    getStringValue(getProviderConnectionMetadata(input), 'rpcEndpoint') ||
    env.AGENTS_OPENCLAW_RPC_ENDPOINT
  );
}

function getE2BMachineClass(input: RuntimeProvisionInput): string | undefined {
  const metadata = getProviderConnectionMetadata(input);
  return (
    getStringValue(metadata, 'machineClass') ?? getStringValue(metadata, 'size')
  );
}

async function getE2BApiKey(input: RuntimeProvisionInput): Promise<string> {
  const env = keys();
  const apiKey =
    env.AGENTS_E2B_API_KEY ||
    (await getProviderToken(input, ProviderConnectionType.E2B));

  if (!apiKey) {
    throw new Error('E2B API key is missing.');
  }

  return apiKey;
}

function mapE2BSandboxState(state: string | undefined): AgentRuntimeStatus {
  switch (state) {
    case 'running':
    case 'paused':
      return AgentRuntimeStatus.READY;
    default:
      return AgentRuntimeStatus.PENDING;
  }
}

export function createE2BDesktopProviderClient(): RuntimeProviderClient {
  return {
    async createRuntime(input) {
      const apiKey = await getE2BApiKey(input);
      const template = getE2BTemplate(input);
      const timeoutMs = getE2BTimeoutMs(input);
      const resolution = getE2BResolution(input);
      const dpi = getE2BDpi(input);
      const allowInternetAccess =
        getBooleanValue(
          getProviderConnectionMetadata(input),
          'allowInternetAccess'
        ) ?? true;

      const opts = {
        apiKey,
        timeoutMs,
        allowInternetAccess,
        metadata: buildE2BSandboxMetadata(input),
        ...(resolution ? { resolution } : {}),
        ...(dpi ? { dpi } : {})
      };

      const sandbox = template
        ? await Sandbox.create(template, opts)
        : await Sandbox.create(opts);

      await sandbox.stream.start({ requireAuth: true });

      const authKey = sandbox.stream.getAuthKey();
      const controlUrl = sandbox.stream.getUrl({
        authKey,
        autoConnect: true,
        resize: 'scale'
      });
      const gatewayUrl = getE2BGatewayUrl(input);

      return {
        provider: AgentRuntimeProvider.E2B,
        deploymentStatus: AgentDeploymentStatus.READY,
        runtimeStatus: AgentRuntimeStatus.READY,
        externalDeploymentId: sandbox.sandboxId,
        externalRuntimeId: sandbox.sandboxId,
        controlUrl,
        gatewayUrl,
        region:
          getStringValue(
            getProviderConnectionMetadata(input),
            'preferredRegion'
          ) ?? input.preferredRegion,
        machineClass:
          getE2BMachineClass(input) ??
          (template ? `desktop:${template}` : 'desktop'),
        metadata: buildE2BRuntimeMetadata(input, {
          sandboxId: sandbox.sandboxId,
          controlUrl,
          streamAuthKey: authKey,
          template,
          timeoutMs,
          resolution,
          dpi,
          state: 'running',
          gatewayUrl
        })
      };
    },
    async syncRuntime(input) {
      const apiKey = await getE2BApiKey(input);
      const sandboxId =
        input.externalRuntimeId ??
        getStringValue(getProviderConnectionMetadata(input), 'sandboxId');

      if (!sandboxId) {
        return {
          provider: AgentRuntimeProvider.E2B,
          deploymentStatus: AgentDeploymentStatus.FAILED,
          runtimeStatus: AgentRuntimeStatus.FAILED,
          metadata: {
            ...getProviderConnectionMetadata(input),
            error: 'Missing E2B sandbox id.'
          }
        };
      }

      try {
        const info = await Sandbox.getInfo(sandboxId, { apiKey });
        const timeoutMs = getE2BTimeoutMs(input);
        const template = getE2BTemplate(input);
        const resolution = getE2BResolution(input);
        const dpi = getE2BDpi(input);
        const gatewayUrl = getE2BGatewayUrl(input);
        const controlUrl = getStringValue(
          getProviderConnectionMetadata(input),
          'controlUrl'
        );

        return {
          provider: AgentRuntimeProvider.E2B,
          deploymentStatus: AgentDeploymentStatus.READY,
          runtimeStatus: mapE2BSandboxState(info.state),
          externalDeploymentId: sandboxId,
          externalRuntimeId: sandboxId,
          controlUrl,
          gatewayUrl,
          region:
            getStringValue(
              getProviderConnectionMetadata(input),
              'preferredRegion'
            ) ?? input.preferredRegion,
          machineClass:
            getE2BMachineClass(input) ??
            (template ? `desktop:${template}` : 'desktop'),
          metadata: buildE2BRuntimeMetadata(input, {
            sandboxId,
            controlUrl,
            streamAuthKey: getStringValue(
              getProviderConnectionMetadata(input),
              'streamAuthKey'
            ),
            template,
            timeoutMs,
            resolution,
            dpi,
            state: info.state,
            gatewayUrl
          })
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';

        if (/404|not found/i.test(message)) {
          return {
            provider: AgentRuntimeProvider.E2B,
            deploymentStatus: AgentDeploymentStatus.FAILED,
            runtimeStatus: AgentRuntimeStatus.FAILED,
            externalDeploymentId: sandboxId,
            externalRuntimeId: sandboxId,
            metadata: {
              ...getProviderConnectionMetadata(input),
              error: message
            }
          };
        }

        throw error;
      }
    }
  };
}

export function createRuntimeProviderClient(
  provider: AgentRuntimeProvider
): RuntimeProviderClient {
  switch (provider) {
    case AgentRuntimeProvider.E2B:
      return createE2BDesktopProviderClient();
    case AgentRuntimeProvider.KILOCLAW:
      return createKiloClawProviderClient();
    default:
      throw new Error(
        `Managed runtime client is not available for ${provider}.`
      );
  }
}

type RpcResponse<TData> = {
  result?: TData;
  error?: {
    message?: string;
  };
};

async function callRpc<TData>(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  authToken?: string
): Promise<TData> {
  const response = await fetchJson<RpcResponse<TData>>(endpoint, {
    method: 'POST',
    headers: createJsonHeaders(authToken),
    body: JSON.stringify({
      id: crypto.randomUUID(),
      jsonrpc: '2.0',
      method,
      params
    })
  });

  if (response.error) {
    throw new Error(response.error.message ?? `RPC ${method} failed`);
  }

  if (!response.result) {
    throw new Error(`RPC ${method} returned no result`);
  }

  return response.result;
}

export function createOpenClawGatewayClient(config: {
  endpoint: string;
  authToken?: string;
}): OpenClawGatewayClient {
  return {
    async listSessions() {
      return callRpc<GatewaySession[]>(
        config.endpoint,
        'sessions_list',
        {},
        config.authToken
      );
    },
    async spawnSession(input: SpawnGatewaySessionInput) {
      return callRpc<GatewaySession>(
        config.endpoint,
        'sessions_spawn',
        input,
        config.authToken
      );
    },
    async sendMessage(input: SendGatewayMessageInput) {
      await callRpc(config.endpoint, 'sessions_send', input, config.authToken);
      return { ok: true as const };
    },
    async getHistory(sessionKey: string) {
      return callRpc<GatewayTranscriptEntry[]>(
        config.endpoint,
        'sessions_history',
        { sessionKey },
        config.authToken
      );
    }
  };
}

export function createKernelBrowserProviderClient(): BrowserProfileProviderClient {
  const env = keys();

  function mapProfileResult(response: JsonRecord): BrowserProfileResult {
    return {
      externalProfileId:
        (response.id as string | undefined) ??
        (response.profileId as string | undefined),
      liveViewUrl:
        (response.liveViewUrl as string | undefined) ??
        (response.devtoolsUrl as string | undefined),
      status:
        (response.status as BrowserProfileStatus | undefined) ??
        BrowserProfileStatus.READY,
      metadata: response
    };
  }

  return {
    async createProfile(input: BrowserProfileInput) {
      const response = await fetchJson<JsonRecord>(
        `${env.AGENTS_KERNEL_API_BASE_URL}/profiles`,
        {
          method: 'POST',
          headers: createJsonHeaders(env.AGENTS_KERNEL_API_KEY),
          body: JSON.stringify({
            name: input.name,
            save_changes: input.saveChanges ?? true,
            managed_auth: input.managedAuth ?? false,
            metadata: input.metadata ?? {}
          })
        }
      );

      return mapProfileResult(response);
    },
    async syncProfile(input: BrowserProfileInput) {
      if (!input.externalProfileId) {
        return {
          status: BrowserProfileStatus.REQUIRES_LOGIN,
          metadata: input.metadata
        };
      }

      const response = await fetchJson<JsonRecord>(
        `${env.AGENTS_KERNEL_API_BASE_URL}/profiles/${input.externalProfileId}`,
        {
          method: 'GET',
          headers: createJsonHeaders(env.AGENTS_KERNEL_API_KEY)
        }
      );

      return mapProfileResult(response);
    }
  };
}

type TelegramApiResponse<TResult> = {
  ok: boolean;
  result?: TResult;
  description?: string;
};

function normalizeTelegramId(value: string): number | string {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

async function callTelegram<TResult>(
  method: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<TResult> {
  const response = await fetchJson<TelegramApiResponse<TResult>>(
    `https://api.telegram.org/bot${accessToken}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error(response.description ?? `Telegram ${method} failed.`);
  }

  if (response.result === undefined) {
    throw new Error(`Telegram ${method} returned no result.`);
  }

  return response.result;
}

export function createTelegramBotClient(): TelegramBotClient {
  return {
    async setWebhook(input: TelegramWebhookInput) {
      await callTelegram('setWebhook', input.accessToken, {
        url: input.webhookUrl,
        secret_token: input.secretToken
      });

      return { ok: true as const };
    },
    async sendMessage(input: TelegramSendMessageInput) {
      const result = await callTelegram<{ message_id?: number }>(
        'sendMessage',
        input.accessToken,
        {
          chat_id: normalizeTelegramId(input.chatId),
          text: input.text,
          ...(input.threadId
            ? {
                message_thread_id: Number(input.threadId)
              }
            : {}),
          ...(input.disableNotification !== undefined
            ? { disable_notification: input.disableNotification }
            : {})
        }
      );

      return {
        ok: true as const,
        messageId:
          typeof result.message_id === 'number'
            ? String(result.message_id)
            : undefined
      };
    }
  };
}

function getTikTokInitPath(directPost?: boolean): string {
  return directPost
    ? '/v2/post/publish/video/init/'
    : '/v2/post/publish/inbox/video/init/';
}

function mapTikTokPublishStatus(status: string | undefined): AgentRunStatus {
  switch (status) {
    case 'PUBLISHED':
    case 'SUCCESS':
      return AgentRunStatus.SUCCEEDED;
    case 'FAILED':
    case 'ERROR':
      return AgentRunStatus.FAILED;
    default:
      return AgentRunStatus.RUNNING;
  }
}

export function createTikTokPublisherClient(): SocialPublisherClient {
  const baseUrl = 'https://open.tiktokapis.com';

  return {
    async publishVideo(input: PublishVideoInput): Promise<PublishVideoResult> {
      const sourceInfo =
        input.source === 'PULL_FROM_URL'
          ? {
              source: input.source,
              video_url: input.videoUrl
            }
          : {
              source: input.source,
              video_size: input.fileUpload?.totalBytes,
              chunk_size: input.fileUpload?.chunkSize,
              total_chunk_count: input.fileUpload?.totalChunkCount
            };

      const response = await fetchJson<{
        data?: {
          publish_id?: string;
          upload_url?: string;
        };
      }>(`${baseUrl}${getTikTokInitPath(input.directPost)}`, {
        method: 'POST',
        headers: createJsonHeaders(input.accessToken, {
          'Content-Type': 'application/json; charset=UTF-8'
        }),
        body: JSON.stringify({
          post_info: input.directPost
            ? {
                title: input.title
              }
            : undefined,
          source_info: sourceInfo
        })
      });

      return {
        publishId: response.data?.publish_id ?? crypto.randomUUID(),
        uploadUrl: response.data?.upload_url,
        status: AgentRunStatus.RUNNING,
        metadata: input.metadata
      };
    },
    async getPublishStatus(
      publishId: string,
      accessToken: string
    ): Promise<PublishVideoStatus> {
      const response = await fetchJson<{
        data?: {
          status?: string;
          post_id?: string;
        };
      }>(`${baseUrl}/v2/post/publish/status/fetch/`, {
        method: 'POST',
        headers: createJsonHeaders(accessToken, {
          'Content-Type': 'application/json; charset=UTF-8'
        }),
        body: JSON.stringify({
          publish_id: publishId
        })
      });

      return {
        publishId,
        status: mapTikTokPublishStatus(response.data?.status),
        postId: response.data?.post_id,
        metadata: response.data
      };
    }
  };
}
