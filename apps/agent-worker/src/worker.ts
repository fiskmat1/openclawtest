import type PgBoss from 'pg-boss';

import {
  AgentJobName,
  createKiloClawProviderClient,
  createKernelBrowserProviderClient,
  createOpenClawGatewayClient,
  createTikTokMarketingBlueprint,
  createTikTokPublisherClient,
  decryptSecret,
  ensureAgentQueues,
  normalizeApprovalPolicy,
  parseAgentJobPayload,
  sendAgentJob,
  type RuntimeProvisionInput
} from '@workspace/agents';
import {
  AgentArtifactType,
  AgentAuditEventType,
  AgentDeploymentStatus,
  AgentRole,
  AgentRunStatus,
  AgentRunStepStatus,
  AgentRunTrigger,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  AgentStatus,
  AgentTeamStatus,
  AgentTeamTemplate,
  ApprovalRequestKind,
  ApprovalRequestStatus,
  ApprovalRiskLevel,
  BrowserProfileStatus,
  MemoryEntryKind,
  Prisma,
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { MonitoringProvider } from '@workspace/monitoring/provider';

import { createAgentAuditLog } from './lib/audit';

function toRecord(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInputJsonValue(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

function mapRuntimeStatusToTeamStatus(
  runtimeStatus: AgentRuntimeStatus
): AgentTeamStatus {
  switch (runtimeStatus) {
    case AgentRuntimeStatus.READY:
      return AgentTeamStatus.ACTIVE;
    case AgentRuntimeStatus.DEGRADED:
      return AgentTeamStatus.DEGRADED;
    case AgentRuntimeStatus.FAILED:
      return AgentTeamStatus.FAILED;
    case AgentRuntimeStatus.STOPPED:
      return AgentTeamStatus.PAUSED;
    default:
      return AgentTeamStatus.PROVISIONING;
  }
}

async function getConnectedProviderConnection(
  organizationId: string,
  type: ProviderConnectionType
) {
  return prisma.providerConnection.findFirst({
    where: {
      organizationId,
      type,
      status: ProviderConnectionStatus.CONNECTED
    }
  });
}

async function getLatestDeployment(teamId: string) {
  return prisma.agentDeployment.findFirst({
    where: { teamId },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

async function handleDeployTeamJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.DeployTeam, payload);
  const deployment = await prisma.agentDeployment.findUnique({
    where: { id: parsed.deploymentId },
    include: {
      team: true,
      providerConnection: true
    }
  });

  if (!deployment) {
    return;
  }

  const providerConnection =
    deployment.providerConnection ??
    (await getConnectedProviderConnection(
      deployment.organizationId,
      ProviderConnectionType.KILO
    ));

  const runtimeInput: RuntimeProvisionInput = {
    organizationId: deployment.organizationId,
    teamId: deployment.teamId,
    teamSlug: deployment.team.slug,
    teamName: deployment.team.name,
    preferredRegion:
      (providerConnection?.metadata &&
        toRecord(providerConnection.metadata).preferredRegion) as
        | string
        | undefined,
    providerConnection: providerConnection
      ? {
          id: providerConnection.id,
          type: providerConnection.type,
          encryptedAccessToken: providerConnection.encryptedAccessToken,
          encryptedRefreshToken: providerConnection.encryptedRefreshToken,
          encryptedSecret: providerConnection.encryptedSecret,
          metadata: toRecord(providerConnection.metadata)
        }
      : undefined,
    metadata: {
      requestBody:
        providerConnection?.metadata && toRecord(providerConnection.metadata)
    }
  };

  try {
    const provider = createKiloClawProviderClient();
    const syncResult = await provider.createRuntime(runtimeInput);

    const runtime = await prisma.agentRuntime.upsert({
      where: {
        id:
          (
            await prisma.agentRuntime.findFirst({
              where: {
                teamId: deployment.teamId,
                provider: syncResult.provider
              },
              select: { id: true }
            })
          )?.id ?? crypto.randomUUID()
      },
      update: {
        provider: syncResult.provider,
        name: `${deployment.team.name} runtime`,
        externalRuntimeId: syncResult.externalRuntimeId,
        gatewayUrl: syncResult.gatewayUrl,
        controlUrl: syncResult.controlUrl,
        region: syncResult.region,
        machineClass: syncResult.machineClass,
        status: syncResult.runtimeStatus,
        lastHeartbeatAt:
          syncResult.runtimeStatus === AgentRuntimeStatus.READY
            ? new Date()
            : undefined,
        metadata: toInputJsonValue(syncResult.metadata)
      },
      create: {
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        provider: syncResult.provider,
        name: `${deployment.team.name} runtime`,
        externalRuntimeId: syncResult.externalRuntimeId,
        gatewayUrl: syncResult.gatewayUrl,
        controlUrl: syncResult.controlUrl,
        region: syncResult.region,
        machineClass: syncResult.machineClass,
        status: syncResult.runtimeStatus,
        lastHeartbeatAt:
          syncResult.runtimeStatus === AgentRuntimeStatus.READY
            ? new Date()
            : undefined,
        metadata: toInputJsonValue(syncResult.metadata)
      }
    });

    await prisma.agentDeployment.update({
      where: { id: deployment.id },
      data: {
        runtimeId: runtime.id,
        providerConnectionId: providerConnection?.id ?? null,
        status: syncResult.deploymentStatus,
        externalDeploymentId: syncResult.externalDeploymentId,
        startedAt: deployment.startedAt ?? new Date(),
        completedAt:
          syncResult.deploymentStatus === AgentDeploymentStatus.READY
            ? new Date()
            : null,
        failedAt:
          syncResult.deploymentStatus === AgentDeploymentStatus.FAILED
            ? new Date()
            : null,
        metadata: toInputJsonValue(syncResult.metadata)
      }
    });

    await prisma.agentTeam.update({
      where: { id: deployment.teamId },
      data: {
        status: mapRuntimeStatusToTeamStatus(syncResult.runtimeStatus)
      }
    });

    await createAgentAuditLog({
      organizationId: deployment.organizationId,
      teamId: deployment.teamId,
      deploymentId: deployment.id,
      actorUserId: deployment.requestedByUserId,
      eventType: AgentAuditEventType.DEPLOYMENT_REQUESTED,
      summary: `Deployment ${syncResult.deploymentStatus.toLowerCase()} for ${deployment.team.name}.`,
      metadata: {
        runtimeId: runtime.id,
        externalDeploymentId: syncResult.externalDeploymentId,
        externalRuntimeId: syncResult.externalRuntimeId,
        provider: syncResult.provider
      }
    });

    if (syncResult.runtimeStatus !== AgentRuntimeStatus.READY) {
      await sendAgentJob(AgentJobName.ReconcileRuntime, {
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        runtimeId: runtime.id
      });
    }
  } catch (error) {
    MonitoringProvider.captureError(error);

    await prisma.agentDeployment.update({
      where: { id: deployment.id },
      data: {
        status: AgentDeploymentStatus.FAILED,
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    await prisma.agentTeam.update({
      where: { id: deployment.teamId },
      data: {
        status: AgentTeamStatus.FAILED
      }
    });

    await createAgentAuditLog({
      organizationId: deployment.organizationId,
      teamId: deployment.teamId,
      deploymentId: deployment.id,
      actorUserId: deployment.requestedByUserId,
      eventType: AgentAuditEventType.DEPLOYMENT_REQUESTED,
      summary: `Deployment failed for ${deployment.team.name}.`,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

async function handleReconcileRuntimeJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.ReconcileRuntime, payload);
  const runtime = await prisma.agentRuntime.findUnique({
    where: { id: parsed.runtimeId },
    include: {
      team: true
    }
  });

  if (!runtime) {
    return;
  }

  if (runtime.provider === AgentRuntimeProvider.SELF_HOSTED) {
    await prisma.agentRuntime.update({
      where: { id: runtime.id },
      data: {
        status: AgentRuntimeStatus.READY,
        lastHeartbeatAt: new Date()
      }
    });

    return;
  }

  const connection = await getConnectedProviderConnection(
    runtime.organizationId,
    ProviderConnectionType.KILO
  );

  const syncResult = await createKiloClawProviderClient().syncRuntime({
    organizationId: runtime.organizationId,
    teamId: runtime.teamId,
    teamSlug: runtime.team.slug,
    teamName: runtime.team.name,
    providerConnection: connection
      ? {
          id: connection.id,
          type: connection.type,
          encryptedAccessToken: connection.encryptedAccessToken,
          encryptedRefreshToken: connection.encryptedRefreshToken,
          encryptedSecret: connection.encryptedSecret,
          metadata: toRecord(connection.metadata)
        }
      : undefined,
    metadata: toRecord(runtime.metadata)
  });

  await prisma.agentRuntime.update({
    where: { id: runtime.id },
    data: {
      externalRuntimeId: syncResult.externalRuntimeId ?? runtime.externalRuntimeId,
      gatewayUrl: syncResult.gatewayUrl ?? runtime.gatewayUrl,
      controlUrl: syncResult.controlUrl ?? runtime.controlUrl,
      status: syncResult.runtimeStatus,
      lastHeartbeatAt: new Date(),
      metadata: toInputJsonValue({
        ...toRecord(runtime.metadata),
        ...(syncResult.metadata ?? {})
      })
    }
  });

  const latestDeployment = await getLatestDeployment(runtime.teamId);
  if (latestDeployment) {
    await prisma.agentDeployment.update({
      where: { id: latestDeployment.id },
      data: {
        status: syncResult.deploymentStatus
      }
    });
  }

  await prisma.agentTeam.update({
    where: { id: runtime.teamId },
    data: {
      status: mapRuntimeStatusToTeamStatus(syncResult.runtimeStatus)
    }
  });

  await createAgentAuditLog({
    organizationId: runtime.organizationId,
    teamId: runtime.teamId,
    deploymentId: latestDeployment?.id,
    eventType: AgentAuditEventType.RUNTIME_RECONCILED,
    summary: `Runtime reconciled with status ${syncResult.runtimeStatus.toLowerCase()}.`,
    metadata: {
      runtimeId: runtime.id,
      status: syncResult.runtimeStatus
    }
  });
}

async function maybeSyncGatewaySessions(teamId: string, organizationId: string) {
  const runtime = await prisma.agentRuntime.findFirst({
    where: {
      teamId,
      status: AgentRuntimeStatus.READY
    }
  });

  if (!runtime?.gatewayUrl) {
    return;
  }

  const openClawConnection = await getConnectedProviderConnection(
    organizationId,
    ProviderConnectionType.OPENCLAW
  );
  const metadata = toRecord(openClawConnection?.metadata);
  const endpoint =
    (metadata.rpcEndpoint as string | undefined) ?? runtime.gatewayUrl;
  const authToken =
    openClawConnection?.encryptedAccessToken
      ? await decryptSecret(openClawConnection.encryptedAccessToken)
      : undefined;

  const gateway = createOpenClawGatewayClient({
    endpoint,
    authToken
  });

  const sessions = await gateway.listSessions();
  const agents = await prisma.agent.findMany({
    where: { teamId }
  });

  for (const agent of agents) {
    if (agent.providerSessionId) {
      continue;
    }

    const existing = sessions.find((session) => session.title === agent.name);
    const session =
      existing ??
      (await gateway.spawnSession({
        teamSlug: runtime.name,
        title: agent.name,
        prompt: agent.systemPrompt ?? agent.goal ?? 'Follow the assigned goal.',
        metadata: {
          role: agent.role
        }
      }));

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        providerSessionId: session.key,
        status: AgentStatus.ACTIVE
      }
    });
  }
}

async function createTikTokArtifacts(runId: string, teamId: string) {
  const team = await prisma.agentTeam.findUnique({
    where: { id: teamId },
    include: {
      organization: true
    }
  });

  if (!team) {
    return [];
  }

  const blueprint = createTikTokMarketingBlueprint(team.organization.name);

  const [scriptArtifact, captionArtifact, reportArtifact, videoArtifact] =
    await prisma.$transaction([
      prisma.agentArtifact.create({
        data: {
          organizationId: team.organizationId,
          teamId: team.id,
          runId,
          type: AgentArtifactType.SCRIPT,
          title: 'Campaign script draft',
          textContent: [
            `Hook: Why ${team.organization.name} should own this TikTok topic now.`,
            '',
            'Scene 1: Introduce the high-contrast pain point in 3 seconds.',
            'Scene 2: Show the product or process in action with one clear outcome.',
            'Scene 3: Close with a punchy CTA and a comment-driving question.'
          ].join('\n'),
          metadata: {
            template: blueprint.template,
            generatedBy: 'agent-worker'
          } as Prisma.InputJsonValue
        }
      }),
      prisma.agentArtifact.create({
        data: {
          organizationId: team.organizationId,
          teamId: team.id,
          runId,
          type: AgentArtifactType.CAPTION,
          title: 'Caption variants',
          textContent: [
            `Variant A: ${team.organization.name} is turning this workflow into a growth loop.`,
            `Variant B: The ${team.organization.name} team turned one idea into a repeatable content system.`,
            'Variant C: Want the checklist? Comment "playbook".'
          ].join('\n'),
          metadata: {
            template: blueprint.template,
            generatedBy: 'agent-worker'
          } as Prisma.InputJsonValue
        }
      }),
      prisma.agentArtifact.create({
        data: {
          organizationId: team.organizationId,
          teamId: team.id,
          runId,
          type: AgentArtifactType.REPORT,
          title: 'Supervisor recommendation',
          textContent:
            'Prioritize fast-turnaround, trend-adjacent experiments and keep the human approval loop only for first publish, credential changes, and paid spend.',
          metadata: {
            template: blueprint.template,
            generatedBy: 'agent-worker'
          } as Prisma.InputJsonValue
        }
      }),
      prisma.agentArtifact.create({
        data: {
          organizationId: team.organizationId,
          teamId: team.id,
          runId,
          type: AgentArtifactType.VIDEO,
          title: 'Rendered video placeholder',
          textContent:
            'Attach a real render URL or upload source before publishing. The publishing flow is API-first once a valid video URL exists.',
          metadata: {
            renderState: 'needs-source-url',
            template: blueprint.template
          } as Prisma.InputJsonValue
        }
      })
    ]);

  await prisma.memoryEntry.createMany({
    data: [
      {
        organizationId: team.organizationId,
        teamId: team.id,
        runId,
        kind: MemoryEntryKind.LESSON,
        title: 'Fast hook preference',
        content:
          'Short-form performance is likely to improve when the hook lands in under three seconds and the CTA invites comments instead of passive likes.',
        score: 0.84,
        source: 'supervisor'
      },
      {
        organizationId: team.organizationId,
        teamId: team.id,
        runId,
        kind: MemoryEntryKind.STRATEGY,
        title: 'Approval-safe publishing loop',
        content:
          'Use official posting APIs when possible, fall back to browser automation only for unsupported paths, and keep first-time publishing behind approval.',
        score: 0.9,
        source: 'policy'
      }
    ]
  });

  return [scriptArtifact, captionArtifact, reportArtifact, videoArtifact];
}

async function handleSuperviseTeamJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.SuperviseTeam, payload);
  const team = await prisma.agentTeam.findUnique({
    where: { id: parsed.teamId },
    include: {
      organization: true,
      runtimes: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  });

  if (!team) {
    return;
  }

  const run =
    (parsed.runId
      ? await prisma.agentRun.findUnique({
          where: { id: parsed.runId }
        })
      : null) ??
    (await prisma.agentRun.create({
      data: {
        organizationId: team.organizationId,
        teamId: team.id,
        runtimeId: team.runtimes[0]?.id ?? null,
        status: AgentRunStatus.RUNNING,
        trigger: AgentRunTrigger.MANUAL,
        title: `${team.name} supervision run`,
        objective:
          team.desiredOutcome ??
          'Keep the agent team aligned with the current operating goal.',
        startedAt: new Date(),
        metadata: {
          reason: parsed.reason
        } as Prisma.InputJsonValue
      }
    }));

  await prisma.agentRunStep.create({
    data: {
      runId: run.id,
      status: AgentRunStepStatus.RUNNING,
      kind: 'supervision',
      title: 'Coordinate team execution',
      detail: `Supervisor run started because: ${parsed.reason}.`,
      startedAt: new Date()
    }
  });

  try {
    await maybeSyncGatewaySessions(team.id, team.organizationId);
  } catch (error) {
    MonitoringProvider.captureError(error);
  }

  const artifacts =
    team.template === AgentTeamTemplate.TIKTOK_MARKETING
      ? await createTikTokArtifacts(run.id, team.id)
      : [];

  const approvalPolicy = normalizeApprovalPolicy(team.approvalPolicy);
  let nextRunStatus: AgentRunStatus = AgentRunStatus.SUCCEEDED;

  if (approvalPolicy.requireApprovalForPublish && artifacts.length > 0) {
    const videoArtifact = artifacts.find(
      (artifact) => artifact.type === AgentArtifactType.VIDEO
    );

    await prisma.approvalRequest.create({
      data: {
        organizationId: team.organizationId,
        teamId: team.id,
        runId: run.id,
        kind: ApprovalRequestKind.PUBLISH_CONTENT,
        status: ApprovalRequestStatus.PENDING,
        riskLevel: ApprovalRiskLevel.HIGH,
        title: `Approve publishing for ${team.name}`,
        description:
          'Review the generated artifacts and approve when you are ready to publish through TikTok.',
        requestedAction: {
          artifactId: videoArtifact?.id,
          runId: run.id,
          provider: ProviderConnectionType.TIKTOK
        } as Prisma.InputJsonValue
      },
      select: {
        id: true
      }
    });

    nextRunStatus = AgentRunStatus.WAITING_APPROVAL;
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      summary:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? 'Artifacts generated and queued for approval.'
          : 'Run completed successfully.',
      status: nextRunStatus,
      completedAt:
        nextRunStatus === AgentRunStatus.SUCCEEDED ? new Date() : null,
      waitingUntil:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? new Date(Date.now() + 1000 * 60 * 60 * 24)
          : null
    }
  });

  await prisma.agentTeam.update({
    where: { id: team.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: team.cadenceCron ? new Date(Date.now() + 1000 * 60 * 60 * 6) : null,
      status: AgentTeamStatus.ACTIVE
    }
  });

  await createAgentAuditLog({
    organizationId: team.organizationId,
    teamId: team.id,
    runId: run.id,
    eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
    summary: `Run transitioned to ${nextRunStatus.toLowerCase()}.`,
    metadata: {
      trigger: parsed.reason,
      artifactCount: artifacts.length
    }
  });
}

async function handlePublishArtifactJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.PublishArtifact, payload);
  const artifact = await prisma.agentArtifact.findUnique({
    where: { id: parsed.artifactId },
    include: {
      run: true,
      team: true
    }
  });

  if (!artifact || !artifact.team) {
    return;
  }

  const approvalPolicy = normalizeApprovalPolicy(artifact.team.approvalPolicy);
  const approvalRequest = parsed.approvalRequestId
    ? await prisma.approvalRequest.findUnique({
        where: { id: parsed.approvalRequestId }
      })
    : null;

  if (
    approvalPolicy.requireApprovalForPublish &&
    approvalRequest?.status !== ApprovalRequestStatus.APPROVED
  ) {
    await prisma.agentRun.update({
      where: { id: artifact.runId ?? parsed.runId ?? '' },
      data: {
        status: AgentRunStatus.WAITING_APPROVAL
      }
    });
    return;
  }

  const tiktokConnection = await getConnectedProviderConnection(
    artifact.organizationId,
    ProviderConnectionType.TIKTOK
  );

  if (!tiktokConnection?.encryptedAccessToken) {
    await prisma.approvalRequest.create({
      data: {
        organizationId: artifact.organizationId,
        teamId: artifact.teamId ?? artifact.team.id,
        runId: artifact.runId,
        kind: ApprovalRequestKind.CONNECT_ACCOUNT,
        status: ApprovalRequestStatus.PENDING,
        riskLevel: ApprovalRiskLevel.MEDIUM,
        title: 'Connect TikTok before publishing',
        description:
          'A connected TikTok account is required before the publishing flow can continue.',
        requestedAction: {
          provider: ProviderConnectionType.TIKTOK
        } as Prisma.InputJsonValue
      }
    });
    return;
  }

  if (!artifact.url) {
    await prisma.agentRun.update({
      where: { id: artifact.runId ?? parsed.runId ?? '' },
      data: {
        status: AgentRunStatus.FAILED,
        summary:
          'Publishing requires a valid video URL. Attach a rendered asset and retry.'
      }
    });

    return;
  }

  const publisher = createTikTokPublisherClient();
  const accessToken = await decryptSecret(tiktokConnection.encryptedAccessToken);
  const publishResult = await publisher.publishVideo({
    accessToken,
    title: artifact.title,
    videoUrl: artifact.url,
    source: 'PULL_FROM_URL',
    directPost: false,
    runId: artifact.runId ?? undefined,
    artifactId: artifact.id
  });

  await prisma.agentArtifact.update({
    where: { id: artifact.id },
    data: {
      externalId: publishResult.publishId,
      metadata: {
        ...toRecord(artifact.metadata),
        publishId: publishResult.publishId,
        uploadUrl: publishResult.uploadUrl
      } as Prisma.InputJsonValue
    }
  });

  if (artifact.runId) {
    await prisma.agentRun.update({
      where: { id: artifact.runId },
      data: {
        status: publishResult.status,
        summary:
          publishResult.status === AgentRunStatus.RUNNING
            ? 'TikTok publishing initialized and awaiting platform completion.'
            : 'TikTok publishing completed.'
      }
    });
  }

  await createAgentAuditLog({
    organizationId: artifact.organizationId,
    teamId: artifact.teamId,
    runId: artifact.runId,
    eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
    summary: `Publishing initialized for artifact ${artifact.title}.`,
    metadata: {
      artifactId: artifact.id,
      publishId: publishResult.publishId
    }
  });
}

async function handleProcessProviderWebhookJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(
    AgentJobName.ProcessProviderWebhook,
    payload
  );

  MonitoringProvider.captureEvent('agent.provider_webhook_received', {
    extra: {
      organizationId: parsed.organizationId,
      provider: parsed.provider
    }
  });

  if (!parsed.organizationId) {
    return;
  }

  const team = await prisma.agentTeam.findFirst({
    where: { organizationId: parsed.organizationId },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  if (!team) {
    return;
  }

  await createAgentAuditLog({
    organizationId: parsed.organizationId,
    teamId: team.id,
    eventType: AgentAuditEventType.RUNTIME_RECONCILED,
    summary: `Received ${parsed.provider} webhook.`,
    metadata: parsed.payload
  });

  const runtime = await prisma.agentRuntime.findFirst({
    where: {
      organizationId: parsed.organizationId,
      teamId: team.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (runtime) {
    await sendAgentJob(AgentJobName.ReconcileRuntime, {
      organizationId: runtime.organizationId,
      teamId: runtime.teamId,
      runtimeId: runtime.id
    });
  }
}

async function handleResolveApprovalTimeoutJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(
    AgentJobName.ResolveApprovalTimeout,
    payload
  );
  const request = await prisma.approvalRequest.findUnique({
    where: { id: parsed.approvalRequestId }
  });

  if (!request || request.status !== ApprovalRequestStatus.PENDING) {
    return;
  }

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: ApprovalRequestStatus.EXPIRED,
      resolvedAt: new Date(),
      decisionReason: 'Automatically expired by worker timeout policy.'
    }
  });

  if (request.runId) {
    await prisma.agentRun.update({
      where: { id: request.runId },
      data: {
        status: AgentRunStatus.FAILED,
        summary: 'Approval request expired before review.'
      }
    });
  }

  await createAgentAuditLog({
    organizationId: request.organizationId,
    teamId: request.teamId,
    runId: request.runId,
    eventType: AgentAuditEventType.APPROVAL_RESOLVED,
    summary: `Approval ${request.title} expired.`,
    metadata: {
      approvalRequestId: request.id
    }
  });
}

export async function startAgentWorker(): Promise<{
  boss: PgBoss;
  stop: () => Promise<void>;
}> {
  await MonitoringProvider.register();
  const boss = await ensureAgentQueues();

  boss.on('error', (error) => {
    MonitoringProvider.captureError(error);
  });

  boss.on('warning', (warning) => {
    MonitoringProvider.captureEvent('agent.queue_warning', {
      extra: warning
    });
  });

  await boss.work(AgentJobName.DeployTeam, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleDeployTeamJob(job.data);
  });

  await boss.work(AgentJobName.ReconcileRuntime, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleReconcileRuntimeJob(job.data);
  });

  await boss.work(AgentJobName.SuperviseTeam, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleSuperviseTeamJob(job.data);
  });

  await boss.work(AgentJobName.PublishArtifact, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handlePublishArtifactJob(job.data);
  });

  await boss.work(AgentJobName.ProcessProviderWebhook, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleProcessProviderWebhookJob(job.data);
  });

  await boss.work(AgentJobName.ResolveApprovalTimeout, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleResolveApprovalTimeoutJob(job.data);
  });

  return {
    boss,
    async stop() {
      await boss.stop();
      await prisma.$disconnect();
    }
  };
}
