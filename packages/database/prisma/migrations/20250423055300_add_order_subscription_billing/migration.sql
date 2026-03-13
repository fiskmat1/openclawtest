/*
  Warnings:

  - You are about to drop the column `tier` on the `Organization` table. All the data in the column will be lost.

*/
-- Rename column and index safely
ALTER TABLE "Organization" RENAME COLUMN "stripeCustomerId" TO "billingCustomerId";
ALTER INDEX "IX_Organization_stripeCustomerId" RENAME TO "IX_Organization_billingCustomerId";
ALTER TABLE "Organization" ALTER COLUMN "billingCustomerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organization"
DROP COLUMN "tier",
ADD COLUMN     "billingCity" VARCHAR(255),
ADD COLUMN     "billingCountry" VARCHAR(3),
ADD COLUMN     "billingEmail" VARCHAR(255),
ADD COLUMN     "billingLine1" VARCHAR(255),
ADD COLUMN     "billingLine2" VARCHAR(255),
ADD COLUMN     "billingPostalCode" VARCHAR(16),
ADD COLUMN     "billingState" VARCHAR(255);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_Order" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceAmount" DOUBLE PRECISION,
    "type" TEXT,
    "model" TEXT,

    CONSTRAINT "PK_OrderItem" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "provider" VARCHAR(32) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL,
    "periodStartsAt" TIMESTAMPTZ(6) NOT NULL,
    "periodEndsAt" TIMESTAMPTZ(6) NOT NULL,
    "trialStartsAt" TIMESTAMPTZ(6),
    "trialEndsAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_Subscription" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionItem" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceAmount" DOUBLE PRECISION,
    "interval" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "type" TEXT,
    "model" TEXT,

    CONSTRAINT "PK_SubscriptionItem" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IX_Order_organizationId" ON "Order"("organizationId");

-- CreateIndex
CREATE INDEX "IX_OrderItem_orderId" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "IX_Subscription_organizationId" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "IX_SubscriptionItem_subscriptionId" ON "SubscriptionItem"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionItem" ADD CONSTRAINT "SubscriptionItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
