import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { PreferencesDto } from '~/types/dtos/preferences-dto';

async function getPreferencesData(userId: string): Promise<PreferencesDto> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.Preferences, userId));

  const userFromDb = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      locale: true
    }
  });

  if (!userFromDb) {
    throw new NotFoundError('User not found');
  }

  return {
    locale: userFromDb.locale
  };
}

export async function getPreferences(): Promise<PreferencesDto> {
  const ctx = await getAuthContext();
  return getPreferencesData(ctx.session.user.id);
}
