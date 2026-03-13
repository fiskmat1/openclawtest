import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey, UserCacheKey } from '~/data/caching';
import {
  getContactIsInFavoritesSchema,
  type GetContactAddedToFavoritesSchema
} from '~/schemas/contacts/get-contact-is-in-favorites-schema';

async function getContactIsInFavoritesData(
  userId: string,
  organizationId: string,
  contactId: string
): Promise<boolean> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createUserTag(UserCacheKey.ContactIsInFavorites, userId, contactId)
  );
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.Favorites,
      organizationId,
      userId
    )
  );

  const count = await prisma.favorite.count({
    where: {
      userId,
      contactId
    }
  });

  return count > 0;
}

export async function getContactIsInFavorites(
  input: GetContactAddedToFavoritesSchema
): Promise<boolean> {
  const ctx = await getAuthOrganizationContext();

  const result = getContactIsInFavoritesSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }

  return getContactIsInFavoritesData(
    ctx.session.user.id,
    ctx.organization.id,
    result.data.contactId
  );
}
