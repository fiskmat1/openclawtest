import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { PersonalDetailsDto } from '~/types/dtos/personal-details-dto';

async function getPersonalDetailsData(userId: string): Promise<PersonalDetailsDto> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.PersonalDetails, userId));

  const userFromDb = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      image: true,
      name: true,
      phone: true,
      email: true
    }
  });

  if (!userFromDb) {
    throw new NotFoundError('User not found');
  }

  return {
    id: userFromDb.id,
    image: userFromDb.image ?? undefined,
    name: userFromDb.name,
    phone: userFromDb.phone ?? undefined,
    email: userFromDb.email ?? undefined
  };
}

export async function getPersonalDetails(): Promise<PersonalDetailsDto> {
  const ctx = await getAuthContext();
  return getPersonalDetailsData(ctx.session.user.id);
}
