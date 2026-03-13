import { prisma } from '@workspace/database/client';

import type { UpsertOrder } from '../provider/types';

export async function upsertOrder(order: UpsertOrder): Promise<void> {
  if (!order.organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { billingCustomerId: order.customerId },
      select: { id: true }
    });
    if (!organization) {
      throw new Error(
        `Billing customer not found for customerId: ${order.customerId}`
      );
    }
    order.organizationId = organization.id;
  }

  const itemIds = order.items.map((item) => item.orderItemId);

  await prisma.$transaction(async (tx) => {
    // Upsert the order
    await tx.order.upsert({
      where: { id: order.orderId },
      create: {
        id: order.orderId,
        organizationId: order.organizationId!,
        status: order.status,
        provider: order.provider,
        currency: order.currency,
        totalAmount: order.totalAmount
      },
      update: {
        status: order.status,
        provider: order.provider,
        currency: order.currency,
        totalAmount: order.totalAmount
      },
      select: {
        id: true // SELECT NONE
      }
    });

    // Delete stale items that no longer exist in Stripe
    await tx.orderItem.deleteMany({
      where: {
        orderId: order.orderId,
        id: { notIn: itemIds }
      }
    });

    // Upsert each order item
    for (const item of order.items) {
      await tx.orderItem.upsert({
        where: { id: item.orderItemId },
        create: {
          id: item.orderItemId,
          orderId: order.orderId,
          quantity: item.quantity,
          productId: item.productId,
          variantId: item.variantId,
          priceAmount: item.priceAmount,
          type: item.type,
          model: item.model
        },
        update: {
          quantity: item.quantity,
          productId: item.productId,
          variantId: item.variantId,
          priceAmount: item.priceAmount,
          type: item.type,
          model: item.model
        }
      });
    }
  });
}
