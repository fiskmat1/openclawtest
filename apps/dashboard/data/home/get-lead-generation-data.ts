import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { endOfDay, format, startOfDay } from 'date-fns';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { ContactRecord } from '@workspace/database';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import {
  getLeadGenerationDataSchema,
  type GetLeadGenerationDataSchema
} from '~/schemas/home/get-lead-generation-data-schema';
import type { LeadGenerationDataPointDto } from '~/types/dtos/lead-generation-data-point-dto';

type ContactData = {
  record: typeof ContactRecord.PERSON | typeof ContactRecord.COMPANY;
  createdAt: Date;
};

async function getLeadGenerationDataCached(
  organizationId: string,
  from: Date,
  to: Date
): Promise<LeadGenerationDataPointDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.LeadGenerationData,
      organizationId
    )
  );
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Contacts, organizationId)
  );

  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: startOfDay(from),
        lte: endOfDay(to)
      }
    },
    select: {
      record: true,
      createdAt: true
    }
  });

  const dataPointsByDate = Object.values(
    contacts.reduce(
      (
        acc: Record<string, LeadGenerationDataPointDto>,
        { record, createdAt }: ContactData
      ) => {
        const date = format(createdAt, 'yyyy-MM-dd');
        acc[date] = acc[date] || { date, people: 0, companies: 0 };
        acc[date][record === ContactRecord.PERSON ? 'people' : 'companies']++;
        return acc;
      },
      {}
    )
  );

  return dataPointsByDate.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export async function getLeadGenerationData(
  input: GetLeadGenerationDataSchema
): Promise<LeadGenerationDataPointDto[]> {
  const ctx = await getAuthOrganizationContext();

  const result = getLeadGenerationDataSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }

  return getLeadGenerationDataCached(
    ctx.organization.id,
    result.data.from,
    result.data.to
  );
}
