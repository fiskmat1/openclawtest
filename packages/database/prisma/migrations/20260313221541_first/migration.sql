-- CreateEnum
CREATE TYPE "AgentArtifactType" AS ENUM ('video', 'script', 'caption', 'image', 'report', 'transcript', 'link', 'json');

-- CreateEnum
CREATE TYPE "AgentAuditEventType" AS ENUM ('teamCreated', 'deploymentRequested', 'approvalResolved', 'integrationUpserted', 'runtimeReconciled', 'runStateTransition');

-- CreateEnum
CREATE TYPE "AgentDeploymentStatus" AS ENUM ('queued', 'provisioning', 'ready', 'degraded', 'failed', 'stopped', 'redeployRequired');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('supervisor', 'researcher', 'creator', 'reviewer', 'publisher');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'waitingApproval', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentRunStepStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'waitingApproval', 'skipped');

-- CreateEnum
CREATE TYPE "AgentRunTrigger" AS ENUM ('manual', 'schedule', 'reconciliation', 'webhook');

-- CreateEnum
CREATE TYPE "AgentRuntimeProvider" AS ENUM ('kiloclaw', 'selfHosted');

-- CreateEnum
CREATE TYPE "AgentRuntimeStatus" AS ENUM ('pending', 'ready', 'degraded', 'failed', 'stopped');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('idle', 'active', 'paused', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "AgentTeamStatus" AS ENUM ('draft', 'provisioning', 'active', 'paused', 'degraded', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "AgentTeamTemplate" AS ENUM ('genericOperations', 'tiktokMarketing');

-- CreateEnum
CREATE TYPE "ApprovalRequestKind" AS ENUM ('publishContent', 'connectAccount', 'spendLimit', 'credentialChange', 'externalPost');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "BrowserProfileProvider" AS ENUM ('kernel', 'openclaw');

-- CreateEnum
CREATE TYPE "BrowserProfileStatus" AS ENUM ('ready', 'requiresLogin', 'syncing', 'error', 'archived');

-- CreateEnum
CREATE TYPE "MemoryEntryKind" AS ENUM ('observation', 'strategy', 'prompt', 'lesson', 'kpi');

-- CreateEnum
CREATE TYPE "ProviderConnectionStatus" AS ENUM ('disconnected', 'connecting', 'connected', 'error');

-- CreateEnum
CREATE TYPE "ProviderConnectionType" AS ENUM ('kilo', 'openclaw', 'kernel', 'tiktok');

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "AgentRole" NOT NULL DEFAULT 'researcher',
    "systemPrompt" TEXT,
    "goal" TEXT,
    "providerSessionId" VARCHAR(255),
    "status" "AgentStatus" NOT NULL DEFAULT 'idle',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_Agent" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentArtifact" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID,
    "runId" UUID,
    "stepId" UUID,
    "agentId" UUID,
    "type" "AgentArtifactType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "url" VARCHAR(2048),
    "storageKey" VARCHAR(1024),
    "mimeType" VARCHAR(255),
    "textContent" TEXT,
    "externalId" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentArtifact" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID,
    "runId" UUID,
    "deploymentId" UUID,
    "actorUserId" UUID,
    "actorAgentId" UUID,
    "eventType" "AgentAuditEventType" NOT NULL,
    "summary" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_AgentAuditLog" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDeployment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "runtimeId" UUID,
    "providerConnectionId" UUID,
    "requestedByUserId" UUID,
    "provider" "AgentRuntimeProvider" NOT NULL DEFAULT 'kiloclaw',
    "status" "AgentDeploymentStatus" NOT NULL DEFAULT 'queued',
    "version" VARCHAR(128),
    "externalDeploymentId" VARCHAR(255),
    "failureReason" VARCHAR(2000),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentDeployment" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "runtimeId" UUID,
    "deploymentId" UUID,
    "initiatedByUserId" UUID,
    "supervisorAgentId" UUID,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "trigger" "AgentRunTrigger" NOT NULL DEFAULT 'manual',
    "title" VARCHAR(255),
    "objective" TEXT,
    "summary" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "waitingUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentRun" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunStep" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "agentId" UUID,
    "status" "AgentRunStepStatus" NOT NULL DEFAULT 'pending',
    "kind" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "detail" TEXT,
    "externalReference" VARCHAR(255),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentRunStep" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntime" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "provider" "AgentRuntimeProvider" NOT NULL DEFAULT 'kiloclaw',
    "name" VARCHAR(255) NOT NULL,
    "externalRuntimeId" VARCHAR(255),
    "gatewayUrl" VARCHAR(2048),
    "controlUrl" VARCHAR(2048),
    "region" VARCHAR(64),
    "machineClass" VARCHAR(64),
    "status" "AgentRuntimeStatus" NOT NULL DEFAULT 'pending',
    "lastHeartbeatAt" TIMESTAMP(3),
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentRuntime" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTeam" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "template" "AgentTeamTemplate" NOT NULL DEFAULT 'genericOperations',
    "description" VARCHAR(2000),
    "desiredOutcome" TEXT,
    "promptPack" JSONB,
    "skillPack" JSONB,
    "cadenceCron" VARCHAR(255),
    "approvalPolicy" JSONB,
    "status" "AgentTeamStatus" NOT NULL DEFAULT 'draft',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_AgentTeam" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "runId" UUID,
    "stepId" UUID,
    "requestedByAgentId" UUID,
    "reviewedByUserId" UUID,
    "kind" "ApprovalRequestKind" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'pending',
    "riskLevel" "ApprovalRiskLevel" NOT NULL DEFAULT 'medium',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "requestedAction" JSONB,
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "decisionReason" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_ApprovalRequest" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID,
    "runtimeId" UUID,
    "providerConnectionId" UUID,
    "provider" "BrowserProfileProvider" NOT NULL DEFAULT 'kernel',
    "name" VARCHAR(255) NOT NULL,
    "externalProfileId" VARCHAR(255),
    "status" "BrowserProfileStatus" NOT NULL DEFAULT 'ready',
    "saveChanges" BOOLEAN NOT NULL DEFAULT true,
    "managedAuth" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_BrowserProfile" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "runId" UUID,
    "agentId" UUID,
    "kind" "MemoryEntryKind" NOT NULL DEFAULT 'observation',
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_MemoryEntry" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "ProviderConnectionType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "encryptedSecret" TEXT,
    "externalAccountId" VARCHAR(255),
    "externalWorkspaceId" VARCHAR(255),
    "scopes" JSONB,
    "metadata" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_ProviderConnection" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IX_Agent_organizationId" ON "Agent"("organizationId");

-- CreateIndex
CREATE INDEX "IX_Agent_teamId" ON "Agent"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentArtifact_organizationId" ON "AgentArtifact"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentArtifact_teamId" ON "AgentArtifact"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentArtifact_runId" ON "AgentArtifact"("runId");

-- CreateIndex
CREATE INDEX "IX_AgentArtifact_stepId" ON "AgentArtifact"("stepId");

-- CreateIndex
CREATE INDEX "IX_AgentArtifact_agentId" ON "AgentArtifact"("agentId");

-- CreateIndex
CREATE INDEX "IX_AgentAuditLog_organizationId" ON "AgentAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentAuditLog_teamId" ON "AgentAuditLog"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentAuditLog_runId" ON "AgentAuditLog"("runId");

-- CreateIndex
CREATE INDEX "IX_AgentAuditLog_deploymentId" ON "AgentAuditLog"("deploymentId");

-- CreateIndex
CREATE INDEX "IX_AgentDeployment_organizationId" ON "AgentDeployment"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentDeployment_teamId" ON "AgentDeployment"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentDeployment_runtimeId" ON "AgentDeployment"("runtimeId");

-- CreateIndex
CREATE INDEX "IX_AgentDeployment_providerConnectionId" ON "AgentDeployment"("providerConnectionId");

-- CreateIndex
CREATE INDEX "IX_AgentRun_organizationId" ON "AgentRun"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentRun_teamId" ON "AgentRun"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentRun_runtimeId" ON "AgentRun"("runtimeId");

-- CreateIndex
CREATE INDEX "IX_AgentRun_deploymentId" ON "AgentRun"("deploymentId");

-- CreateIndex
CREATE INDEX "IX_AgentRunStep_runId" ON "AgentRunStep"("runId");

-- CreateIndex
CREATE INDEX "IX_AgentRunStep_agentId" ON "AgentRunStep"("agentId");

-- CreateIndex
CREATE INDEX "IX_AgentRuntime_organizationId" ON "AgentRuntime"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentRuntime_teamId" ON "AgentRuntime"("teamId");

-- CreateIndex
CREATE INDEX "IX_AgentTeam_organizationId" ON "AgentTeam"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AgentTeam_status" ON "AgentTeam"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTeam_organizationId_slug_key" ON "AgentTeam"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "IX_ApprovalRequest_organizationId" ON "ApprovalRequest"("organizationId");

-- CreateIndex
CREATE INDEX "IX_ApprovalRequest_teamId" ON "ApprovalRequest"("teamId");

-- CreateIndex
CREATE INDEX "IX_ApprovalRequest_runId" ON "ApprovalRequest"("runId");

-- CreateIndex
CREATE INDEX "IX_ApprovalRequest_stepId" ON "ApprovalRequest"("stepId");

-- CreateIndex
CREATE INDEX "IX_BrowserProfile_organizationId" ON "BrowserProfile"("organizationId");

-- CreateIndex
CREATE INDEX "IX_BrowserProfile_teamId" ON "BrowserProfile"("teamId");

-- CreateIndex
CREATE INDEX "IX_BrowserProfile_runtimeId" ON "BrowserProfile"("runtimeId");

-- CreateIndex
CREATE INDEX "IX_BrowserProfile_providerConnectionId" ON "BrowserProfile"("providerConnectionId");

-- CreateIndex
CREATE INDEX "IX_MemoryEntry_organizationId" ON "MemoryEntry"("organizationId");

-- CreateIndex
CREATE INDEX "IX_MemoryEntry_teamId" ON "MemoryEntry"("teamId");

-- CreateIndex
CREATE INDEX "IX_MemoryEntry_runId" ON "MemoryEntry"("runId");

-- CreateIndex
CREATE INDEX "IX_MemoryEntry_agentId" ON "MemoryEntry"("agentId");

-- CreateIndex
CREATE INDEX "IX_ProviderConnection_organizationId" ON "ProviderConnection"("organizationId");

-- CreateIndex
CREATE INDEX "IX_ProviderConnection_type" ON "ProviderConnection"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_organizationId_type_name_key" ON "ProviderConnection"("organizationId", "type", "name");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "AgentDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDeployment" ADD CONSTRAINT "AgentDeployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDeployment" ADD CONSTRAINT "AgentDeployment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDeployment" ADD CONSTRAINT "AgentDeployment_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "AgentRuntime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDeployment" ADD CONSTRAINT "AgentDeployment_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDeployment" ADD CONSTRAINT "AgentDeployment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "AgentRuntime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "AgentDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_supervisorAgentId_fkey" FOREIGN KEY ("supervisorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunStep" ADD CONSTRAINT "AgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunStep" ADD CONSTRAINT "AgentRunStep_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntime" ADD CONSTRAINT "AgentRuntime_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntime" ADD CONSTRAINT "AgentRuntime_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTeam" ADD CONSTRAINT "AgentTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedByAgentId_fkey" FOREIGN KEY ("requestedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "AgentRuntime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
