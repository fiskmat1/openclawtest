'use server';
import { updateTag } from 'next/cache';


import { prisma } from '@workspace/database/client';

import { updateFavoritesOrder } from '~/actions/favorites/_favorites-order';
import { authOrganizationActionClient } from '~/actions/safe-action';
import { Caching, OrganizationCacheKey, UserCacheKey } from '~/data/caching';
import { removeFavoriteSchema } from '~/schemas/favorites/remove-favorite-schema';

export const removeFavorite = authOrganizationActionClient
  .metadata({ actionName: 'removeFavorite' })
  .inputSchema(removeFavoriteSchema)
  .action(async ({ parsedInput, ctx }) => {
    await prisma.$transaction([
      prisma.favorite.deleteMany({
        where: {
          userId: ctx.session.user.id,
          contactId: parsedInput.contactId
        }
      }),
      updateFavoritesOrder(ctx.session.user.id)
    ]);

    updateTag(
      Caching.createOrganizationTag(
        OrganizationCacheKey.Favorites,
        ctx.organization.id,
        ctx.session.user.id
      )
    );

    updateTag(
      Caching.createUserTag(
        UserCacheKey.ContactIsInFavorites,
        ctx.session.user.id,
        parsedInput.contactId
      )
    );
  });
