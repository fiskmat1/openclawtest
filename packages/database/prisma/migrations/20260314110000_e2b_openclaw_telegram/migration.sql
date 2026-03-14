ALTER TYPE "AgentRuntimeProvider" ADD VALUE IF NOT EXISTS 'e2b';

ALTER TYPE "ProviderConnectionType" ADD VALUE IF NOT EXISTS 'e2b';
ALTER TYPE "ProviderConnectionType" ADD VALUE IF NOT EXISTS 'telegram';

CREATE TYPE "AgentControlChannelType" AS ENUM ('telegram');

CREATE TYPE "AgentControlChannelStatus" AS ENUM ('active', 'paused', 'error');

CREATE TABLE "AgentControlChannel" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "runtimeId" UUID,
    "providerConnectionId" UUID NOT NULL,
    "type" "AgentControlChannelType" NOT NULL DEFAULT 'telegram',
    "status" "AgentControlChannelStatus" NOT NULL DEFAULT 'active',
    "name" VARCHAR(255) NOT NULL,
    "externalChannelId" VARCHAR(255) NOT NULL,
    "externalThreadId" VARCHAR(255),
    "externalUserId" VARCHAR(255),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentControlChannel" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UX_AgentControlChannel_channelThread"
ON "AgentControlChannel"("providerConnectionId", "externalChannelId", "externalThreadId");

CREATE INDEX "IX_AgentControlChannel_organizationId"
ON "AgentControlChannel"("organizationId");

CREATE INDEX "IX_AgentControlChannel_teamId"
ON "AgentControlChannel"("teamId");

CREATE INDEX "IX_AgentControlChannel_runtimeId"
ON "AgentControlChannel"("runtimeId");

CREATE INDEX "IX_AgentControlChannel_providerConnectionId"
ON "AgentControlChannel"("providerConnectionId");

CREATE INDEX "IX_AgentControlChannel_status"
ON "AgentControlChannel"("status");

ALTER TABLE "AgentControlChannel"
ADD CONSTRAINT "FK_AgentControlChannel_organizationId"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentControlChannel"
ADD CONSTRAINT "FK_AgentControlChannel_teamId"
FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentControlChannel"
ADD CONSTRAINT "FK_AgentControlChannel_runtimeId"
FOREIGN KEY ("runtimeId") REFERENCES "AgentRuntime"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentControlChannel"
ADD CONSTRAINT "FK_AgentControlChannel_providerConnectionId"
FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
