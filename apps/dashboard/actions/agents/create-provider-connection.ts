'use server';

import { encryptSecret } from '@workspace/agents/encryption';
import { createTelegramBotClient } from '@workspace/agents/provider-clients';
import {
  AgentAuditEventType,
  Prisma,
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import {
  assertCanManageAgents,
  maybeQueueAutoDeployForEligibleTeams,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { authOrganizationActionClient } from '~/actions/safe-action';
import { createProviderConnectionSchema } from '~/schemas/agents/create-provider-connection-schema';

function parseMetadataJson(value?: string): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(value) as Prisma.InputJsonValue;
}

function toRecord(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeTelegramWebhookSecret(secret?: string): string {
  const normalized = (secret ?? crypto.randomUUID().replace(/-/g, ''))
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 256);

  if (normalized.length === 0) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return normalized;
}

function getTelegramWebhookBaseUrl(
  metadata: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): string | undefined {
  const metadataRecord = toRecord(metadata);
  const metadataBaseUrl = metadataRecord.webhookBaseUrl;

  if (typeof metadataBaseUrl === 'string' && metadataBaseUrl.length > 0) {
    return metadataBaseUrl.replace(/\/$/, '');
  }

  return process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, '');
}

function getConnectionStatus(parsedInput: {
  type: ProviderConnectionType;
  accessToken?: string;
  refreshToken?: string;
  secret?: string;
  externalAccountId?: string;
  externalWorkspaceId?: string;
}): ProviderConnectionStatus {
  if (
    parsedInput.type === ProviderConnectionType.TELEGRAM &&
    !parsedInput.accessToken
  ) {
    return ProviderConnectionStatus.CONNECTING;
  }

  return parsedInput.accessToken ||
    parsedInput.refreshToken ||
    parsedInput.secret ||
    parsedInput.externalAccountId ||
    parsedInput.externalWorkspaceId
    ? ProviderConnectionStatus.CONNECTED
    : ProviderConnectionStatus.CONNECTING;
}

export const createProviderConnection = authOrganizationActionClient
  .metadata({ actionName: 'createProviderConnection' })
  .inputSchema(createProviderConnectionSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const metadata = parseMetadataJson(parsedInput.metadataJson);
    const normalizedSecret =
      parsedInput.type === ProviderConnectionType.TELEGRAM
        ? normalizeTelegramWebhookSecret(parsedInput.secret)
        : parsedInput.secret;

    const encryptedAccessToken = parsedInput.accessToken
      ? await encryptSecret(parsedInput.accessToken)
      : undefined;
    const encryptedRefreshToken = parsedInput.refreshToken
      ? await encryptSecret(parsedInput.refreshToken)
      : undefined;
    const encryptedSecret = normalizedSecret
      ? await encryptSecret(normalizedSecret)
      : undefined;

    const connection = await prisma.providerConnection.upsert({
      where: {
        organizationId_type_name: {
          organizationId: ctx.organization.id,
          type: parsedInput.type,
          name: parsedInput.name
        }
      },
      update: {
        status: getConnectionStatus(parsedInput),
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedSecret,
        externalAccountId: parsedInput.externalAccountId ?? null,
        externalWorkspaceId: parsedInput.externalWorkspaceId ?? null,
        metadata
      },
      create: {
        organizationId: ctx.organization.id,
        type: parsedInput.type,
        name: parsedInput.name,
        status: getConnectionStatus(parsedInput),
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedSecret,
        externalAccountId: parsedInput.externalAccountId ?? null,
        externalWorkspaceId: parsedInput.externalWorkspaceId ?? null,
        metadata
      },
      select: {
        id: true,
        type: true,
        metadata: true
      }
    });

    if (
      connection.type === ProviderConnectionType.TELEGRAM &&
      parsedInput.accessToken
    ) {
      const webhookBaseUrl = getTelegramWebhookBaseUrl(connection.metadata);

      if (webhookBaseUrl && normalizedSecret) {
        const webhookUrl = `${webhookBaseUrl}/api/agents/channels/telegram/${connection.id}`;

        try {
          await createTelegramBotClient().setWebhook({
            accessToken: parsedInput.accessToken,
            webhookUrl,
            secretToken: normalizedSecret
          });

          await prisma.providerConnection.update({
            where: {
              id: connection.id
            },
            data: {
              lastVerifiedAt: new Date(),
              status: ProviderConnectionStatus.CONNECTED
            }
          });
        } catch (error) {
          await prisma.providerConnection.update({
            where: {
              id: connection.id
            },
            data: {
              status: ProviderConnectionStatus.ERROR
            }
          });

          throw error;
        }
      }
    }

    if (
      connection.type === ProviderConnectionType.E2B ||
      connection.type === ProviderConnectionType.OPENCLAW
    ) {
      await maybeQueueAutoDeployForEligibleTeams({
        organizationId: ctx.organization.id,
        requestedByUserId: ctx.session.user.id
      });
    }

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.INTEGRATION_UPSERTED,
        summary: `Upserted ${parsedInput.type.toLowerCase()} integration ${parsedInput.name}.`,
        metadata: {
          connectionId: connection.id,
          type: parsedInput.type,
          webhookRegistered:
            parsedInput.type === ProviderConnectionType.TELEGRAM
              ? Boolean(
                  parsedInput.accessToken &&
                  getTelegramWebhookBaseUrl(connection.metadata)
                )
              : undefined
        }
      },
      select: {
        id: true
      }
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      connectionId: connection.id
    };
  });
