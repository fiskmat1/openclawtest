import {
  AgentDeploymentStatus,
  AgentRunStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  BrowserProfileStatus,
  ProviderConnectionType
} from '@workspace/database';

import { keys } from '../keys';
import type {
  BrowserProfileInput,
  BrowserProfileProviderClient,
  BrowserProfileResult,
  GatewaySession,
  GatewayTranscriptEntry,
  KiloClawProviderClient,
  OpenClawGatewayClient,
  PublishVideoInput,
  PublishVideoResult,
  PublishVideoStatus,
  RuntimeProvisionInput,
  RuntimeSyncResult,
  SendGatewayMessageInput,
  SocialPublisherClient,
  SpawnGatewaySessionInput
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

function getProviderToken(
  input: RuntimeProvisionInput,
  provider: ProviderConnectionType
): string | undefined {
  if (input.providerConnection?.type !== provider) {
    return undefined;
  }

  return input.providerConnection.metadata?.accessToken as string | undefined;
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

export function createKiloClawProviderClient(): KiloClawProviderClient {
  const env = keys();

  return {
    async createRuntime(input) {
      const apiKey =
        env.AGENTS_KILO_API_KEY ||
        getProviderToken(input, ProviderConnectionType.KILO);

      const requestBody =
        input.metadata?.requestBody && typeof input.metadata.requestBody === 'object'
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
        getProviderToken(input, ProviderConnectionType.KILO);

      if (!input.metadata?.statusEndpoint) {
        return {
          provider: AgentRuntimeProvider.KILOCLAW,
          deploymentStatus: AgentDeploymentStatus.PROVISIONING,
          runtimeStatus: AgentRuntimeStatus.PENDING,
          externalRuntimeId: input.metadata?.externalRuntimeId as string | undefined,
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
      await callRpc(
        config.endpoint,
        'sessions_send',
        input,
        config.authToken
      );
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
