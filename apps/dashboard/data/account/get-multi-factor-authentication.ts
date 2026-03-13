import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, UserCacheKey } from '~/data/caching';
import type { MultiFactorAuthenticationDto } from '~/types/dtos/multi-factor-authentication-dto';

async function getMultiFactorAuthenticationData(
  userId: string
): Promise<MultiFactorAuthenticationDto> {
  'use cache';
  cacheLife('default');
  cacheTag(Caching.createUserTag(UserCacheKey.MultiFactorAuthentication, userId));

  const authenticatorApp = await prisma.authenticatorApp.findFirst({
    where: { userId },
    select: {
      id: true,
      accountName: true,
      issuer: true,
      createdAt: true
    }
  });

  return {
    authenticatorApp: authenticatorApp ?? undefined
  };
}

export async function getMultiFactorAuthentication(): Promise<MultiFactorAuthenticationDto> {
  const ctx = await getAuthContext();
  return getMultiFactorAuthenticationData(ctx.session.user.id);
}
