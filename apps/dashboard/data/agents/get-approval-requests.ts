import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import { toJsonRecord } from '~/data/agents/_helpers';
import type { ApprovalRequestDto } from '~/types/dtos/approval-request-dto';
import { SortDirection } from '~/types/sort-direction';

async function getApprovalRequestsData(
  organizationId: string
): Promise<ApprovalRequestDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.AgentApprovals,
      organizationId
    )
  );

  const approvals = await prisma.approvalRequest.findMany({
    where: { organizationId },
    select: {
      id: true,
      runId: true,
      kind: true,
      status: true,
      riskLevel: true,
      title: true,
      description: true,
      decisionReason: true,
      createdAt: true,
      expiresAt: true,
      resolvedAt: true,
      requestedAction: true,
      team: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Desc
    }
  });

  return approvals.map((approval) => ({
    id: approval.id,
    teamId: approval.team.id,
    teamName: approval.team.name,
    runId: approval.runId ?? undefined,
    kind: approval.kind,
    status: approval.status,
    riskLevel: approval.riskLevel,
    title: approval.title,
    description: approval.description ?? undefined,
    decisionReason: approval.decisionReason ?? undefined,
    createdAt: approval.createdAt,
    expiresAt: approval.expiresAt ?? undefined,
    resolvedAt: approval.resolvedAt ?? undefined,
    requestedAction: toJsonRecord(approval.requestedAction)
  }));
}

export async function getApprovalRequests(): Promise<ApprovalRequestDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getApprovalRequestsData(ctx.organization.id);
}
