ALTER TYPE "ProviderConnectionType" ADD VALUE IF NOT EXISTS 'openai';

ALTER TABLE "AgentTeam"
ADD COLUMN "teamSpec" JSONB,
ADD COLUMN "blueprint" JSONB,
ADD COLUMN "supervisorConfig" JSONB;

ALTER TABLE "AgentRuntime"
ADD COLUMN "supervisorState" JSONB,
ADD COLUMN "lockKey" VARCHAR(255),
ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

CREATE INDEX "IX_AgentRuntime_lockExpiresAt"
ON "AgentRuntime"("lockExpiresAt");
