import { prisma } from '@workspace/database/client';

import type { UpsertSubscription } from '../provider/types';

export async function upsertSubscription(
  subscription: UpsertSubscription
): Promise<void> {
  if (!subscription.organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { billingCustomerId: subscription.customerId },
      select: {
        id: true
      }
    });
    if (!organization) {
      throw new Error(
        `Billing customer not found for customerId: ${subscription.customerId}`
      );
    }
    subscription.organizationId = organization.id;
  }

  const itemIds = subscription.items.map((item) => item.subscriptionItemId);

  await prisma.$transaction(async (tx) => {
    // Upsert the subscription
    await tx.subscription.upsert({
      where: { id: subscription.subscriptionId },
      create: {
        id: subscription.subscriptionId,
        organizationId: subscription.organizationId!,
        status: subscription.status,
        active: subscription.active,
        provider: subscription.provider,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currency: subscription.currency,
        periodStartsAt: subscription.periodStartsAt,
        periodEndsAt: subscription.periodEndsAt,
        trialEndsAt: subscription.trialEndsAt,
        trialStartsAt: subscription.trialStartsAt
      },
      update: {
        status: subscription.status,
        active: subscription.active,
        provider: subscription.provider,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currency: subscription.currency,
        periodStartsAt: subscription.periodStartsAt,
        periodEndsAt: subscription.periodEndsAt,
        trialEndsAt: subscription.trialEndsAt,
        trialStartsAt: subscription.trialStartsAt
      },
      select: {
        id: true // SELECT NONE
      }
    });

    // Delete stale items that no longer exist in Stripe
    await tx.subscriptionItem.deleteMany({
      where: {
        subscriptionId: subscription.subscriptionId,
        id: { notIn: itemIds }
      }
    });

    // Upsert each subscription item
    for (const item of subscription.items) {
      await tx.subscriptionItem.upsert({
        where: { id: item.subscriptionItemId },
        create: {
          id: item.subscriptionItemId,
          subscriptionId: subscription.subscriptionId,
          quantity: item.quantity,
          productId: item.productId,
          variantId: item.variantId,
          priceAmount: item.priceAmount,
          interval: item.interval,
          intervalCount: item.intervalCount,
          type: item.type,
          model: item.model
        },
        update: {
          quantity: item.quantity,
          productId: item.productId,
          variantId: item.variantId,
          priceAmount: item.priceAmount,
          interval: item.interval,
          intervalCount: item.intervalCount,
          type: item.type,
          model: item.model
        }
      });
    }
  });
}
