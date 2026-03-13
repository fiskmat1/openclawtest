'use server';

import { createKernelBrowserProviderClient } from '@workspace/agents';
import {
  AgentAuditEventType,
  BrowserProfileProvider,
  BrowserProfileStatus,
  Prisma,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import {
  assertCanManageAgents,
  updateAgentCacheTags
} from '~/actions/agents/_helpers';
import { createBrowserProfileSchema } from '~/schemas/agents/create-browser-profile-schema';

export const createBrowserProfile = authOrganizationActionClient
  .metadata({ actionName: 'createBrowserProfile' })
  .inputSchema(createBrowserProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    assertCanManageAgents(ctx);

    const connection = await prisma.providerConnection.findFirst({
      where: {
        id: parsedInput.providerConnectionId,
        organizationId: ctx.organization.id
      }
    });

    if (!connection || connection.type !== ProviderConnectionType.KERNEL) {
      throw new Error('Kernel integration not found.');
    }

    let providerStatus: BrowserProfileStatus =
      BrowserProfileStatus.REQUIRES_LOGIN;
    let externalProfileId: string | undefined;
    let metadata: Prisma.InputJsonValue | undefined;

    try {
      const profile = await createKernelBrowserProviderClient().createProfile({
        organizationId: ctx.organization.id,
        teamId: parsedInput.teamId,
        name: parsedInput.name,
        managedAuth: parsedInput.managedAuth,
        saveChanges: parsedInput.saveChanges
      });

      providerStatus = profile.status;
      externalProfileId = profile.externalProfileId;
      metadata = profile.metadata
        ? (profile.metadata as Prisma.InputJsonValue)
        : undefined;
    } catch (error) {
      providerStatus = BrowserProfileStatus.ERROR;
      metadata = {
        error: error instanceof Error ? error.message : 'Unknown error'
      } as Prisma.InputJsonValue;
    }

    const browserProfile = await prisma.browserProfile.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: parsedInput.teamId ?? null,
        runtimeId: null,
        providerConnectionId: connection.id,
        provider: BrowserProfileProvider.KERNEL,
        name: parsedInput.name,
        externalProfileId,
        status: providerStatus,
        saveChanges: parsedInput.saveChanges,
        managedAuth: parsedInput.managedAuth,
        metadata
      },
      select: {
        id: true
      }
    });

    await prisma.agentAuditLog.create({
      data: {
        organizationId: ctx.organization.id,
        teamId: parsedInput.teamId ?? null,
        actorUserId: ctx.session.user.id,
        eventType: AgentAuditEventType.INTEGRATION_UPSERTED,
        summary: `Created browser profile ${parsedInput.name}.`,
        metadata: {
          browserProfileId: browserProfile.id,
          providerConnectionId: connection.id
        }
      },
      select: {
        id: true
      }
    });

    updateAgentCacheTags(ctx.organization.id);

    return {
      browserProfileId: browserProfile.id
    };
  });
