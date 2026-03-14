'use server';

import { updateTag } from 'next/cache';

import {
  AgentJobName,
  scheduleAgentJob,
  sendAgentJob,
  unscheduleAgentJob
} from '@workspace/agents';
import { keys as agentKeys } from '@workspace/agents/keys';
import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ForbiddenError } from '@workspace/common/errors';
import {
  AgentDeploymentStatus,
  AgentRuntimeProvider,
  AgentTeamStatus,
  ProviderConnectionStatus,
  ProviderConnectionType,
  Role
} from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';

type AuthOrganizationContext = Awaited<
  ReturnType<typeof getAuthOrganizationContext>
>;

export function assertCanManageAgents(ctx: AuthOrganizationContext): void {
  const membership = ctx.session.user.memberships.find(
    (item) => item.organizationId === ctx.organization.id
  );

  if (!membership || (!membership.isOwner && membership.role !== Role.ADMIN)) {
    throw new ForbiddenError('Only organization admins can manage agents.');
  }
}

export function updateAgentCacheTags(organizationId: string): void {
  const keys = [
    OrganizationCacheKey.AgentOverview,
    OrganizationCacheKey.AgentTeams,
    OrganizationCacheKey.AgentDeployments,
    OrganizationCacheKey.AgentRuns,
    OrganizationCacheKey.AgentApprovals,
    OrganizationCacheKey.AgentIntegrations,
    OrganizationCacheKey.AgentBrowserProfiles
  ] as const;

  for (const key of keys) {
    updateTag(Caching.createOrganizationTag(key, organizationId));
  }
}

function canAutoDeploy(status: AgentDeploymentStatus | undefined): boolean {
  return (
    !status ||
    status === AgentDeploymentStatus.FAILED ||
    status === AgentDeploymentStatus.STOPPED ||
    status === AgentDeploymentStatus.REDEPLOY_REQUIRED
  );
}

async function getPreferredRuntimeConnection(organizationId: string) {
  return prisma.providerConnection.findFirst({
    where: {
      organizationId,
      type: ProviderConnectionType.E2B,
      status: ProviderConnectionStatus.CONNECTED
    },
    orderBy: {
      updatedAt: 'desc'
    },
    select: {
      id: true
    }
  });
}

async function hasOpenClawConnectivity(
  organizationId: string
): Promise<boolean> {
  if (Boolean(agentKeys().AGENTS_OPENCLAW_RPC_ENDPOINT)) {
    return true;
  }

  const connection = await prisma.providerConnection.findFirst({
    where: {
      organizationId,
      type: ProviderConnectionType.OPENCLAW,
      status: ProviderConnectionStatus.CONNECTED
    },
    select: {
      id: true
    }
  });

  return Boolean(connection);
}

export async function maybeQueueAutoDeployForTeam(args: {
  organizationId: string;
  teamId: string;
  requestedByUserId?: string;
}): Promise<boolean> {
  const [team, runtimeConnection, openClawReady, latestDeployment] =
    await Promise.all([
      prisma.agentTeam.findFirst({
        where: {
          id: args.teamId,
          organizationId: args.organizationId,
          status: {
            not: AgentTeamStatus.ARCHIVED
          }
        },
        select: {
          id: true
        }
      }),
      getPreferredRuntimeConnection(args.organizationId),
      hasOpenClawConnectivity(args.organizationId),
      prisma.agentDeployment.findFirst({
        where: {
          organizationId: args.organizationId,
          teamId: args.teamId
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          status: true
        }
      })
    ]);

  if (!team || !runtimeConnection || !openClawReady) {
    return false;
  }

  if (!canAutoDeploy(latestDeployment?.status)) {
    return false;
  }

  const deployment = await prisma.agentDeployment.create({
    data: {
      organizationId: args.organizationId,
      teamId: args.teamId,
      provider: AgentRuntimeProvider.E2B,
      status: AgentDeploymentStatus.QUEUED,
      providerConnectionId: runtimeConnection.id,
      requestedByUserId: args.requestedByUserId ?? null
    },
    select: {
      id: true
    }
  });

  await prisma.agentTeam.update({
    where: {
      id: args.teamId
    },
    data: {
      status: AgentTeamStatus.PROVISIONING
    }
  });

  await sendAgentJob(AgentJobName.DeployTeam, {
    organizationId: args.organizationId,
    teamId: args.teamId,
    deploymentId: deployment.id,
    requestedByUserId: args.requestedByUserId
  });

  updateAgentCacheTags(args.organizationId);

  return true;
}

export async function maybeQueueAutoDeployForEligibleTeams(args: {
  organizationId: string;
  requestedByUserId?: string;
}): Promise<number> {
  const teams = await prisma.agentTeam.findMany({
    where: {
      organizationId: args.organizationId,
      status: {
        not: AgentTeamStatus.ARCHIVED
      }
    },
    select: {
      id: true
    }
  });

  let queuedCount = 0;

  for (const team of teams) {
    if (
      await maybeQueueAutoDeployForTeam({
        organizationId: args.organizationId,
        teamId: team.id,
        requestedByUserId: args.requestedByUserId
      })
    ) {
      queuedCount += 1;
    }
  }

  return queuedCount;
}

export async function syncTeamCadenceSchedule(args: {
  organizationId: string;
  teamId: string;
  cron?: string | null;
}): Promise<void> {
  await unscheduleAgentJob(AgentJobName.SuperviseTeam, args.teamId);

  if (!args.cron) {
    return;
  }

  await scheduleAgentJob(
    AgentJobName.SuperviseTeam,
    args.cron,
    {
      organizationId: args.organizationId,
      teamId: args.teamId,
      reason: 'scheduled'
    },
    {
      key: args.teamId
    }
  );
}
