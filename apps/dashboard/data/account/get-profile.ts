import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ForbiddenError, NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { ProfileDto } from '~/types/dtos/profile-dto';

async function getProfileData(userId: string): Promise<Omit<ProfileDto, 'isOwner' | 'role'>> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.Profile, userId));
  cacheTag(Caching.createUserTag(UserCacheKey.PersonalDetails, userId));
  cacheTag(Caching.createUserTag(UserCacheKey.Preferences, userId));

  const userFromDb = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      image: true,
      name: true,
      email: true,
      locale: true
    }
  });

  if (!userFromDb) {
    throw new NotFoundError('User not found');
  }

  return {
    id: userFromDb.id,
    image: userFromDb.image ?? undefined,
    name: userFromDb.name,
    email: userFromDb.email ?? undefined,
    locale: userFromDb.locale
  };
}

export async function getProfile(): Promise<ProfileDto> {
  const ctx = await getAuthOrganizationContext();
  const activeMembership = ctx.session.user.memberships.find(
    (m: { organizationId: string }) => m.organizationId === ctx.organization.id
  );
  if (!activeMembership) {
    throw new ForbiddenError('User is not a member of this organization');
  }

  const profile = await getProfileData(ctx.session.user.id);

  return {
    ...profile,
    // These fields are not cached - they come from the current session
    isOwner: activeMembership.isOwner,
    role: activeMembership.role
  };
}
