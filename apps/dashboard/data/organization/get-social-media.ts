import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { SocialMediaDto } from '~/types/dtos/social-media-dto';

async function getSocialMediaData(organizationId: string): Promise<SocialMediaDto> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.SocialMedia, organizationId)
  );

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      linkedInProfile: true,
      youTubeChannel: true,
      instagramProfile: true,
      xProfile: true,
      tikTokProfile: true,
      facebookPage: true
    }
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return {
    linkedInProfile: organization.linkedInProfile
      ? organization.linkedInProfile
      : undefined,
    instagramProfile: organization.instagramProfile
      ? organization.instagramProfile
      : undefined,
    youTubeChannel: organization.youTubeChannel
      ? organization.youTubeChannel
      : undefined,
    xProfile: organization.xProfile ? organization.xProfile : undefined,
    tikTokProfile: organization.tikTokProfile
      ? organization.tikTokProfile
      : undefined,
    facebookPage: organization.facebookPage
      ? organization.facebookPage
      : undefined
  };
}

export async function getSocialMedia(): Promise<SocialMediaDto> {
  const ctx = await getAuthOrganizationContext();
  return getSocialMediaData(ctx.organization.id);
}
