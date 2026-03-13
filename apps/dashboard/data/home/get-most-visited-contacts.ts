import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { endOfDay, startOfDay } from 'date-fns';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import {
  getMostVisitedContactsSchema,
  type GetMostVisitedContactsSchema
} from '~/schemas/home/get-most-vistied-contacts-schema';
import type { VisitedContactDto } from '~/types/dtos/visited-contact-dto';
import { SortDirection } from '~/types/sort-direction';

async function getMostVisitedContactsData(
  organizationId: string,
  from: Date,
  to: Date
): Promise<VisitedContactDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.ContactPageVisits,
      organizationId
    )
  );
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Contacts, organizationId)
  );

  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      image: true,
      record: true,
      _count: {
        select: {
          pageVisits: {
            where: {
              timestamp: {
                gte: startOfDay(from),
                lte: endOfDay(to)
              }
            }
          }
        }
      }
    },
    orderBy: {
      pageVisits: {
        _count: SortDirection.Desc
      }
    },
    take: 6
  });

  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    image: contact.image ?? undefined,
    record: contact.record,
    pageVisits: contact._count.pageVisits
  }));
}

export async function getMostVisitedContacts(
  input: GetMostVisitedContactsSchema
): Promise<VisitedContactDto[]> {
  const ctx = await getAuthOrganizationContext();

  const result = getMostVisitedContactsSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }

  return getMostVisitedContactsData(
    ctx.organization.id,
    result.data.from,
    result.data.to
  );
}
