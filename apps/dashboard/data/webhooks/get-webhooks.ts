import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import type { WebhookDto } from '~/types/dtos/webhook-dto';
import { SortDirection } from '~/types/sort-direction';

async function getWebhooksData(organizationId: string): Promise<WebhookDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Webhooks, organizationId)
  );

  const webhooks = await prisma.webhook.findMany({
    where: { organizationId },
    select: {
      id: true,
      url: true,
      triggers: true,
      secret: true
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return webhooks.map((webhook) => ({
    id: webhook.id,
    url: webhook.url,
    triggers: webhook.triggers,
    secret: webhook.secret ?? undefined
  }));
}

export async function getWebhooks(): Promise<WebhookDto[]> {
  const ctx = await getAuthOrganizationContext();
  return getWebhooksData(ctx.organization.id);
}
