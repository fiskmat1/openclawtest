import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { MarketingEmailsDto } from '~/types/dtos/marketing-emails-dto';

async function getMarketingEmailSettingsData(
  userId: string
): Promise<MarketingEmailsDto> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.MarketingEmails, userId));

  const userFromDb = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      enabledNewsletter: true,
      enabledProductUpdates: true
    }
  });

  if (!userFromDb) {
    throw new NotFoundError('User not found');
  }

  return {
    enabledNewsletter: userFromDb.enabledNewsletter,
    enabledProductUpdates: userFromDb.enabledProductUpdates
  };
}

export async function getMarketingEmailSettings(): Promise<MarketingEmailsDto> {
  const ctx = await getAuthContext();
  return getMarketingEmailSettingsData(ctx.session.user.id);
}
