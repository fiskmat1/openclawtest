import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { WorkHoursDto } from '~/types/dtos/work-hours-dto';

async function getBusinessHoursData(
  organizationId: string
): Promise<WorkHoursDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.BusinessHours,
      organizationId
    )
  );

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      businessHours: {
        select: {
          dayOfWeek: true,
          timeSlots: {
            select: {
              id: true,
              start: true,
              end: true
            }
          }
        }
      }
    }
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization.businessHours.map((workHours) => ({
    dayOfWeek: workHours.dayOfWeek,
    timeSlots: workHours.timeSlots.map((timeSlot) => ({
      id: timeSlot.id,
      start: timeSlot.start.toISOString(),
      end: timeSlot.end.toISOString()
    }))
  }));
}

export async function getBusinessHours(): Promise<WorkHoursDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getBusinessHoursData(ctx.organization.id);
}
