import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { MemberDto } from '~/types/dtos/member-dto';
import { SortDirection } from '~/types/sort-direction';

async function getMembersData(organizationId: string): Promise<MemberDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Members, organizationId)
  );

  const members = await prisma.membership.findMany({
    where: { organizationId },
    select: {
      role: true,
      isOwner: true,
      user: {
        select: {
          id: true,
          image: true,
          name: true,
          email: true,
          lastLogin: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return members.map((member) => ({
    id: member.user.id,
    image: member.user.image ?? undefined,
    name: member.user.name,
    email: member.user.email!,
    role: member.role,
    isOwner: member.isOwner,
    dateAdded: member.user.createdAt,
    lastLogin: member.user.lastLogin ?? undefined
  }));
}

export async function getMembers(): Promise<MemberDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getMembersData(ctx.organization.id);
}
