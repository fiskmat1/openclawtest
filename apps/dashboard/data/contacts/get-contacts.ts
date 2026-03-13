import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';
import { ContactRecord } from '@workspace/database';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import {
  getContactsSchema,
  RecordsOption,
  type GetContactsSchema
} from '~/schemas/contacts/get-contacts-schema';
import type { ContactDto } from '~/types/dtos/contact-dto';

type GetContactsResult = {
  contacts: ContactDto[];
  filteredCount: number;
  totalCount: number;
};

type SearchParams = {
  organizationId: string;
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortDirection: string;
  tags: string[];
  records: RecordsOption;
  searchQuery?: string;
};

function mapRecords(option: RecordsOption): ContactRecord | undefined {
  switch (option) {
    case RecordsOption.People:
      return ContactRecord.PERSON;
    case RecordsOption.Companies:
      return ContactRecord.COMPANY;
  }
  return undefined;
}

async function getContactsData(params: SearchParams): Promise<GetContactsResult> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.Contacts,
      params.organizationId
    )
  );

  const searchCriteria = params.searchQuery
    ? { contains: params.searchQuery, mode: 'insensitive' as const }
    : undefined;
  const searchVector = searchCriteria
    ? [{ name: searchCriteria }, { email: searchCriteria }]
    : undefined;

  const [contacts, filteredCount, totalCount] = await prisma.$transaction([
    prisma.contact.findMany({
      skip: params.pageIndex * params.pageSize,
      take: params.pageSize,
      where: {
        organizationId: params.organizationId,
        record: mapRecords(params.records),
        tags:
          params.tags && params.tags.length > 0
            ? { some: { text: { in: params.tags } } }
            : undefined,
        OR: searchVector
      },
      select: {
        id: true,
        record: true,
        image: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        stage: true,
        createdAt: true,
        tags: {
          select: {
            id: true,
            text: true
          }
        }
      },
      orderBy: {
        [params.sortBy]: params.sortDirection
      }
    }),
    prisma.contact.count({
      where: {
        organizationId: params.organizationId,
        record: mapRecords(params.records),
        tags:
          params.tags && params.tags.length > 0
            ? { some: { text: { in: params.tags } } }
            : undefined,
        OR: searchVector
      }
    }),
    prisma.contact.count({
      where: {
        organizationId: params.organizationId
      }
    })
  ]);

  const mapped: ContactDto[] = contacts.map((contact) => ({
    id: contact.id,
    record: contact.record,
    image: contact.image ? contact.image : undefined,
    name: contact.name,
    email: contact.email ? contact.email : undefined,
    address: contact.address ? contact.address : undefined,
    phone: contact.phone ? contact.phone : undefined,
    stage: contact.stage,
    createdAt: contact.createdAt,
    tags: contact.tags
  }));

  return { contacts: mapped, filteredCount, totalCount };
}

export async function getContacts(input: GetContactsSchema): Promise<GetContactsResult> {
  const ctx = await getAuthOrganizationContext();

  const result = getContactsSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }
  const parsedInput = result.data;

  return getContactsData({
    organizationId: ctx.organization.id,
    pageIndex: parsedInput.pageIndex,
    pageSize: parsedInput.pageSize,
    sortBy: parsedInput.sortBy,
    sortDirection: parsedInput.sortDirection,
    tags: parsedInput.tags,
    records: parsedInput.records,
    searchQuery: parsedInput.searchQuery
  });
}
