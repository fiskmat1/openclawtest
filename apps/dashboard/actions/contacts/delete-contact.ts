'use server';
import { updateTag } from 'next/cache';


import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { authOrganizationActionClient } from '~/actions/safe-action';
import { Caching, OrganizationCacheKey } from '~/data/caching';
import { deleteContactSchema } from '~/schemas/contacts/delete-contact-schema';

export const deleteContact = authOrganizationActionClient
  .metadata({ actionName: 'deleteContact' })
  .inputSchema(deleteContactSchema)
  .action(async ({ parsedInput, ctx }) => {
    const count = await prisma.contact.count({
      where: {
        organizationId: ctx.organization.id,
        id: parsedInput.id
      }
    });
    if (count < 1) {
      throw new NotFoundError('Contact not found');
    }

    await prisma.$transaction([
      prisma.contactImage.deleteMany({
        where: { contactId: parsedInput.id }
      }),
      prisma.contact.delete({
        where: { id: parsedInput.id },
        select: {
          id: true // SELECT NONE
        }
      })
    ]);

    updateTag(
      Caching.createOrganizationTag(
        OrganizationCacheKey.Contacts,
        ctx.organization.id
      )
    );

    updateTag(
      Caching.createOrganizationTag(
        OrganizationCacheKey.Contact,
        ctx.organization.id,
        parsedInput.id
      )
    );

    for (const membership of ctx.organization.memberships) {
      updateTag(
        Caching.createOrganizationTag(
          OrganizationCacheKey.Favorites,
          ctx.organization.id,
          membership.userId
        )
      );
    }
  });
