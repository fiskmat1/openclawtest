import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { InvitationStatus } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { InvitationDto } from '~/types/dtos/invitation-dto';
import { SortDirection } from '~/types/sort-direction';

async function getInvitationsData(
  organizationId: string
): Promise<InvitationDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.Invitations,
      organizationId
    )
  );

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId,
      NOT: { status: { equals: InvitationStatus.ACCEPTED } }
    },
    select: {
      id: true,
      token: true,
      status: true,
      email: true,
      role: true,
      createdAt: true,
      lastSentAt: true
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    token: invitation.token,
    status: invitation.status,
    email: invitation.email,
    role: invitation.role,
    lastSent: invitation.lastSentAt ?? undefined,
    dateAdded: invitation.createdAt
  }));
}

export async function getInvitations(): Promise<InvitationDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getInvitationsData(ctx.organization.id);
}
