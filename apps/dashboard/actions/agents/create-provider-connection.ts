'use server';

import { encryptSecret } from '@workspace/agents';
import {
  AgentAuditEventType,
  Prisma,
  ProviderConnectionStatus
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { createProviderConnectionSchema } from '~/schemas/agents/create-provider-connection-schema';

function parseMetadataJson(value?: string): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(value) as Prisma.InputJsonValue;
}

function getConnectionStatus(parsedInput: {
  accessToken?: string;
  refreshToken?: string;
  secret?: string;
  externalAccountId?: string;
  externalWorkspaceId?: string;
}): ProviderConnectionStatus {
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

    const encryptedAccessToken = parsedInput.accessToken
      ? await encryptSecret(parsedInput.accessToken)
      : undefined;
    const encryptedRefreshToken = parsedInput.refreshToken
      ? await encryptSecret(parsedInput.refreshToken)
      : undefined;
    const encryptedSecret = parsedInput.secret
      ? await encryptSecret(parsedInput.secret)
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
        metadata: parseMetadataJson(parsedInput.metadataJson)
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
        metadata: parseMetadataJson(parsedInput.metadataJson)
      },
      select: {
        id: true
      }
    });

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.INTEGRATION_UPSERTED,
        summary: `Upserted ${parsedInput.type.toLowerCase()} integration ${parsedInput.name}.`,
        metadata: {
          connectionId: connection.id,
          type: parsedInput.type
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
