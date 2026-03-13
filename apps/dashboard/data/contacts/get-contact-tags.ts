import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { TagDto } from '~/types/dtos/tag-dto';
import { SortDirection } from '~/types/sort-direction';

async function getContactTagsData(organizationId: string): Promise<TagDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.ContactTags, organizationId)
  );
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Contacts, organizationId)
  );

  const contactTags = await prisma.contactTag.findMany({
    where: {
      contacts: {
        some: {
          organizationId
        }
      }
    },
    select: {
      id: true,
      text: true
    },
    orderBy: {
      text: SortDirection.Asc
    }
  });

  return contactTags;
}

export async function getContactTags(): Promise<TagDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getContactTagsData(ctx.organization.id);
}
