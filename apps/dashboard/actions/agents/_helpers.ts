'use server';

import { updateTag } from 'next/cache';

import { scheduleAgentJob, unscheduleAgentJob, AgentJobName } from '@workspace/agents';
import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ForbiddenError } from '@workspace/common/errors';
import { Role } from '@workspace/database';

import { Caching, OrganizationCacheKey } from '~/data/caching';

type AuthOrganizationContext = Awaited<ReturnType<typeof getAuthOrganizationContext>>;

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
