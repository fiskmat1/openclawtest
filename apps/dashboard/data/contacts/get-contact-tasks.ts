import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import {
  getContactTasksSchema,
  type GetContactTasksSchema
} from '~/schemas/contacts/get-contact-tasks-schema';
import type { ContactTaskDto } from '~/types/dtos/contact-task-dto';
import { SortDirection } from '~/types/sort-direction';

async function getContactTasksData(
  organizationId: string,
  contactId: string
): Promise<ContactTaskDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.ContactTasks,
      organizationId,
      contactId
    )
  );

  const tasks = await prisma.contactTask.findMany({
    where: {
      contactId,
      contact: {
        organizationId
      }
    },
    select: {
      id: true,
      contactId: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      createdAt: true
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return tasks.map((task) => ({
    id: task.id,
    contactId: task.contactId ?? undefined,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    dueDate: task.dueDate ?? undefined,
    createdAt: task.createdAt
  }));
}

export async function getContactTasks(
  input: GetContactTasksSchema
): Promise<ContactTaskDto[]> {
  const ctx = await getAuthOrganizationContext();

  const result = getContactTasksSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }

  return getContactTasksData(ctx.organization.id, result.data.contactId);
}
