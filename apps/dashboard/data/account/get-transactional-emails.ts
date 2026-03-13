import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { TransactionalEmailsDto } from '~/types/dtos/transactional-emails-dto';

async function getTransactionalEmailsData(
  userId: string
): Promise<TransactionalEmailsDto> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.TransactionalEmails, userId));

  const userFromDb = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      enabledContactsNotifications: true,
      enabledInboxNotifications: true,
      enabledWeeklySummary: true
    }
  });

  if (!userFromDb) {
    throw new NotFoundError('User not found');
  }

  return {
    enabledContactsNotifications: userFromDb.enabledContactsNotifications,
    enabledInboxNotifications: userFromDb.enabledInboxNotifications,
    enabledWeeklySummary: userFromDb.enabledWeeklySummary
  };
}

export async function getTransactionalEmails(): Promise<TransactionalEmailsDto> {
  const ctx = await getAuthContext();
  return getTransactionalEmailsData(ctx.session.user.id);
}
