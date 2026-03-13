import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { OrganizationDto } from '~/types/dtos/organization-dto';

type OrganizationWithMembership = {
  id: string;
  logo: string | null;
  name: string;
  slug: string;
  _count: { memberships: number };
  memberships: { createdAt: Date }[];
};

async function getOrganizationsData(userId: string): Promise<OrganizationDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.Organizations, userId));

  const organizations = await prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          userId
        }
      }
    },
    select: {
      id: true,
      logo: true,
      name: true,
      slug: true,
      _count: {
        select: {
          memberships: true
        }
      },
      memberships: {
        where: { userId },
        select: { createdAt: true }
      }
    }
  });

  return organizations
    .sort(
      (a: OrganizationWithMembership, b: OrganizationWithMembership) =>
        a.memberships[0].createdAt.getTime() -
        b.memberships[0].createdAt.getTime()
    )
    .map((organization: OrganizationWithMembership) => ({
      id: organization.id,
      logo: organization.logo ? organization.logo : undefined,
      name: organization.name,
      slug: organization.slug,
      memberCount: organization._count.memberships
    }));
}

export async function getOrganizations(): Promise<OrganizationDto[]> {
  const ctx = await getAuthContext();
  return getOrganizationsData(ctx.session.user.id);
}
