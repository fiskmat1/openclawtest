import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';

async function getOrganizationLogoData(
  organizationId: string
): Promise<string | undefined> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.OrganizationLogo,
      organizationId
    )
  );

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      logo: true
    }
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization.logo ? organization.logo : undefined;
}

export async function getOrganizationLogo(): Promise<string | undefined> {
  const ctx = await getAuthOrganizationContext();
  return getOrganizationLogoData(ctx.organization.id);
}
