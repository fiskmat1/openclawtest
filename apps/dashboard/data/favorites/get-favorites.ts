import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { FavoriteDto } from '~/types/dtos/favorite-dto';
import { SortDirection } from '~/types/sort-direction';

async function getFavoritesData(
  organizationId: string,
  userId: string
): Promise<FavoriteDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.Favorites,
      organizationId,
      userId
    )
  );

  const favorites = await prisma.favorite.findMany({
    where: {
      userId,
      contact: {
        organizationId
      }
    },
    select: {
      id: true,
      order: true,
      contact: {
        select: {
          id: true,
          name: true,
          record: true,
          image: true
        }
      }
    },
    orderBy: {
      order: SortDirection.Asc
    }
  });

  return favorites.map((favorite) => ({
    id: favorite.id,
    order: favorite.order,
    contactId: favorite.contact.id,
    name: favorite.contact.name,
    record: favorite.contact.record,
    image: favorite.contact.image ? favorite.contact.image : undefined
  }));
}

export async function getFavorites(): Promise<FavoriteDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getFavoritesData(ctx.organization.id, ctx.session.user.id);
}
