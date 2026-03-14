import { Buffer } from 'node:buffer';
import { setTimeout as sleep } from 'node:timers/promises';
import type PgBoss from 'pg-boss';
import { Sandbox } from '@e2b/desktop';

import {
  AgentJobName,
  createOpenClawGatewayClient,
  createRuntimeProviderClient,
  createTikTokMarketingBlueprint,
  createTikTokPublisherClient,
  decryptSecret,
  ensureAgentQueues,
  normalizeApprovalPolicy,
  parseAgentJobPayload,
  sendAgentJob,
  type OpenClawGatewayClient,
  type ProcessProviderWebhookJobPayload,
  type RuntimeProvisionInput
} from '@workspace/agents';
import { keys as agentKeys } from '@workspace/agents/keys';
import {
  AgentArtifactType,
  AgentAuditEventType,
  AgentDeploymentStatus,
  AgentRole,
  AgentRunStatus,
  AgentRunStepStatus,
  AgentRuntimeProvider,
  AgentRuntimeStatus,
  AgentRunTrigger,
  AgentStatus,
  AgentTeamStatus,
  AgentTeamTemplate,
  ApprovalRequestKind,
  ApprovalRequestStatus,
  ApprovalRiskLevel,
  MemoryEntryKind,
  Prisma,
  ProviderConnectionStatus,
  ProviderConnectionType
} from '@workspace/database';
import { prisma } from '@workspace/database/client';
import { MonitoringProvider } from '@workspace/monitoring/provider';

import { createAgentAuditLog } from './lib/audit';
import {
  markControlChannelInbound,
  notifyControlChannel,
  notifyControlChannelWithTranscript,
  notifyTeamControlChannels
} from './lib/control-channels';
import {
  buildAgentExecutionPrompt,
  getLatestAssistantReply
} from './lib/gateway';

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

function getRuntimeProviderConnectionType(
  provider: AgentRuntimeProvider
): ProviderConnectionType | undefined {
  switch (provider) {
    case AgentRuntimeProvider.E2B:
      return ProviderConnectionType.E2B;
    case AgentRuntimeProvider.KILOCLAW:
      return ProviderConnectionType.KILO;
    default:
      return undefined;
  }
}

async function createGatewayClientForRuntime(args: {
  organizationId: string;
  runtime: {
    gatewayUrl: string | null;
  };
}) {
  const openClawConnection = await getConnectedProviderConnection(
    args.organizationId,
    ProviderConnectionType.OPENCLAW
  );
  const metadata = toRecord(openClawConnection?.metadata);
  const endpoint =
    (metadata.rpcEndpoint as string | undefined) ??
    args.runtime.gatewayUrl ??
    agentKeys().AGENTS_OPENCLAW_RPC_ENDPOINT;
  const authToken = openClawConnection?.encryptedAccessToken
    ? await decryptSecret(openClawConnection.encryptedAccessToken)
    : agentKeys().AGENTS_OPENCLAW_SHARED_PASSWORD;

  if (!endpoint) {
    return null;
  }

  return createOpenClawGatewayClient({
    endpoint,
    authToken
  });
}

async function getE2BApiKeyForOrganization(
  organizationId: string
): Promise<string | undefined> {
  const connection = await getConnectedProviderConnection(
    organizationId,
    ProviderConnectionType.E2B
  );

  if (connection?.encryptedAccessToken) {
    return decryptSecret(connection.encryptedAccessToken);
  }

  return agentKeys().AGENTS_E2B_API_KEY;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildInitialAgentSessionPrompt(args: {
  teamName: string;
  desiredOutcome?: string | null;
  agentName: string;
  agentRole: string;
  agentGoal?: string | null;
  systemPrompt?: string | null;
}): string {
  return [
    `Team: ${args.teamName}`,
    `Desired outcome: ${args.desiredOutcome ?? 'No desired outcome provided.'}`,
    `Agent: ${args.agentName}`,
    `Role: ${args.agentRole}`,
    `Goal: ${args.agentGoal ?? 'No explicit goal provided.'}`,
    `System prompt: ${args.systemPrompt ?? 'No explicit system prompt provided.'}`,
    'You are one member of a supervised OpenClaw team. Stay aligned with the desired outcome, keep your replies concise and actionable, and be ready to coordinate with the supervisor through OpenClaw session tools when asked.'
  ].join('\n');
}

function buildDesktopBriefHtml(args: {
  teamName: string;
  teamSlug: string;
  desiredOutcome?: string | null;
  controlUrl?: string | null;
  gatewayUrl?: string | null;
  externalRuntimeId?: string | null;
  agents: Array<{
    name: string;
    role: string;
    goal?: string | null;
    providerSessionId?: string | null;
  }>;
}): string {
  const generatedAt = new Date().toISOString();
  const roster = args.agents
    .map(
      (agent) => `
        <li>
          <strong>${escapeHtml(agent.name)}</strong>
          <div>Role: ${escapeHtml(agent.role)}</div>
          <div>Goal: ${escapeHtml(agent.goal ?? 'No explicit goal provided.')}</div>
          <div>Session: ${escapeHtml(agent.providerSessionId ?? 'Pending')}</div>
        </li>
      `
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.teamName)} runtime brief</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: #0f172a;
        color: #e2e8f0;
        padding: 32px;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
      }
      h1, h2 {
        margin-bottom: 12px;
      }
      section {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 20px;
      }
      code {
        display: inline-block;
        background: rgba(30, 41, 59, 0.9);
        padding: 2px 6px;
        border-radius: 6px;
      }
      ul {
        padding-left: 20px;
      }
      li + li {
        margin-top: 12px;
      }
      .muted {
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${escapeHtml(args.teamName)}</h1>
        <p class="muted">Generated at ${escapeHtml(generatedAt)}</p>
        <p><strong>Team slug:</strong> <code>${escapeHtml(args.teamSlug)}</code></p>
        <p><strong>Desired outcome:</strong> ${escapeHtml(args.desiredOutcome ?? 'No desired outcome provided.')}</p>
      </section>
      <section>
        <h2>Runtime</h2>
        <p><strong>Sandbox ID:</strong> <code>${escapeHtml(args.externalRuntimeId ?? 'Unavailable')}</code></p>
        <p><strong>Live view:</strong> ${escapeHtml(args.controlUrl ?? 'Unavailable')}</p>
        <p><strong>OpenClaw endpoint:</strong> ${escapeHtml(args.gatewayUrl ?? 'Unavailable')}</p>
      </section>
      <section>
        <h2>Agent roster</h2>
        <ul>${roster}</ul>
      </section>
      <section>
        <h2>Operator notes</h2>
        <p>This desktop is the shared workspace for the runtime. The supervisor should use the desired outcome above to coordinate the agent sessions, keep a running plan, and check that the researcher and reviewer stay aligned with the goal.</p>
      </section>
    </main>
  </body>
</html>`;
}

async function writeTextFileToSandbox(args: {
  sandbox: Sandbox;
  path: string;
  content: string;
}): Promise<void> {
  const encoded = Buffer.from(args.content, 'utf8').toString('base64');
  await args.sandbox.commands.run(
    `python3 - <<'PY'
from pathlib import Path
import base64

path = Path(${JSON.stringify(args.path)})
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(base64.b64decode(${JSON.stringify(encoded)}).decode('utf-8'))
PY`
  );
}

async function bootstrapRuntimeDesktop(args: {
  organizationId: string;
  runtimeId: string;
  teamId: string;
}): Promise<void> {
  const runtime = await prisma.agentRuntime.findUnique({
    where: {
      id: args.runtimeId
    },
    include: {
      team: {
        include: {
          agents: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      }
    }
  });

  if (
    !runtime ||
    runtime.provider !== AgentRuntimeProvider.E2B ||
    !runtime.externalRuntimeId
  ) {
    return;
  }

  const apiKey = await getE2BApiKeyForOrganization(args.organizationId);
  if (!apiKey) {
    return;
  }

  const briefPath = '/home/user/Desktop/openclaw-team-brief.html';
  const sandbox = await Sandbox.connect(runtime.externalRuntimeId, {
    apiKey
  });
  const html = buildDesktopBriefHtml({
    teamName: runtime.team.name,
    teamSlug: runtime.team.slug,
    desiredOutcome: runtime.team.desiredOutcome,
    controlUrl: runtime.controlUrl,
    gatewayUrl: runtime.gatewayUrl,
    externalRuntimeId: runtime.externalRuntimeId,
    agents: runtime.team.agents.map((agent) => ({
      name: agent.name,
      role: agent.role,
      goal: agent.goal,
      providerSessionId: agent.providerSessionId
    }))
  });

  await writeTextFileToSandbox({
    sandbox,
    path: briefPath,
    content: html
  });

  try {
    await sandbox.launch('google-chrome', `file://${briefPath}`);
  } catch {
    await sandbox.open(briefPath);
  }

  await prisma.agentRuntime.update({
    where: {
      id: runtime.id
    },
    data: {
      metadata: {
        ...toRecord(runtime.metadata),
        desktopBriefPath: briefPath,
        desktopBootstrappedAt: new Date().toISOString()
      } as Prisma.InputJsonValue
    }
  });
}

async function notifyTeam(args: {
  teamId: string;
  text: string;
}): Promise<void> {
  await notifyTeamControlChannels({
    teamId: args.teamId,
    text: args.text
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

  const providerConnectionType = getRuntimeProviderConnectionType(
    deployment.provider
  );
  const providerConnection =
    deployment.providerConnection ??
    (providerConnectionType
      ? await getConnectedProviderConnection(
          deployment.organizationId,
          providerConnectionType
        )
      : null);
  const providerMetadata = toRecord(providerConnection?.metadata);

  const runtimeInput: RuntimeProvisionInput = {
    organizationId: deployment.organizationId,
    teamId: deployment.teamId,
    teamSlug: deployment.team.slug,
    teamName: deployment.team.name,
    preferredRegion:
      (providerMetadata.preferredRegion as string | undefined) ?? undefined,
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
      ...providerMetadata,
      requestBody: providerMetadata
    }
  };

  try {
    const syncResult =
      deployment.provider === AgentRuntimeProvider.SELF_HOSTED
        ? {
            provider: AgentRuntimeProvider.SELF_HOSTED,
            deploymentStatus: AgentDeploymentStatus.READY,
            runtimeStatus: AgentRuntimeStatus.READY,
            controlUrl: providerMetadata.controlUrl as string | undefined,
            gatewayUrl:
              (providerMetadata.rpcEndpoint as string | undefined) ??
              agentKeys().AGENTS_OPENCLAW_RPC_ENDPOINT,
            region: providerMetadata.preferredRegion as string | undefined,
            machineClass: providerMetadata.machineClass as string | undefined,
            metadata: providerMetadata
          }
        : await createRuntimeProviderClient(deployment.provider).createRuntime(
            runtimeInput
          );

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
    } else {
      await maybeSyncGatewaySessions(
        deployment.teamId,
        deployment.organizationId,
        runtime.id
      );
      await bootstrapRuntimeDesktop({
        organizationId: deployment.organizationId,
        runtimeId: runtime.id,
        teamId: deployment.teamId
      });
      await sendAgentJob(AgentJobName.SuperviseTeam, {
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        reason: 'deployment-bootstrap'
      });
    }

    await notifyTeam({
      teamId: deployment.teamId,
      text:
        syncResult.deploymentStatus === AgentDeploymentStatus.READY
          ? `Deployment ready for ${deployment.team.name}. Live view: ${syncResult.controlUrl ?? 'Unavailable'}`
          : `Deployment ${syncResult.deploymentStatus.toLowerCase()} for ${deployment.team.name}.`
    });
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

    await notifyTeam({
      teamId: deployment.teamId,
      text: `Deployment failed for ${deployment.team.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  const providerConnectionType = getRuntimeProviderConnectionType(
    runtime.provider
  );
  const connection = providerConnectionType
    ? await getConnectedProviderConnection(
        runtime.organizationId,
        providerConnectionType
      )
    : null;

  const syncResult = await createRuntimeProviderClient(
    runtime.provider
  ).syncRuntime({
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
      externalRuntimeId:
        syncResult.externalRuntimeId ?? runtime.externalRuntimeId,
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

  if (syncResult.runtimeStatus === AgentRuntimeStatus.READY) {
    await maybeSyncGatewaySessions(
      runtime.teamId,
      runtime.organizationId,
      runtime.id
    );
  }

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

  await notifyTeam({
    teamId: runtime.teamId,
    text: `Runtime reconciled for ${runtime.team.name} with status ${syncResult.runtimeStatus.toLowerCase()}.`
  });
}

async function maybeSyncGatewaySessions(
  teamId: string,
  organizationId: string,
  runtimeId?: string
) {
  const runtime = await prisma.agentRuntime.findFirst({
    where: {
      ...(runtimeId ? { id: runtimeId } : { teamId }),
      teamId,
      status: AgentRuntimeStatus.READY
    }
  });

  if (!runtime) {
    return;
  }

  const gateway = await createGatewayClientForRuntime({
    organizationId,
    runtime
  });

  if (!gateway) {
    return;
  }

  const sessions = await gateway.listSessions();
  const [team, agents] = await Promise.all([
    prisma.agentTeam.findUnique({
      where: {
        id: teamId
      },
      select: {
        name: true,
        desiredOutcome: true
      }
    }),
    prisma.agent.findMany({
      where: { teamId }
    })
  ]);

  if (!team) {
    return;
  }

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
        prompt: buildInitialAgentSessionPrompt({
          teamName: team.name,
          desiredOutcome: team.desiredOutcome,
          agentName: agent.name,
          agentRole: agent.role,
          agentGoal: agent.goal,
          systemPrompt: agent.systemPrompt
        }),
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

type GatewayAgentExecution = {
  agentId: string;
  agentName: string;
  sessionKey: string;
  transcript: Awaited<ReturnType<OpenClawGatewayClient['getHistory']>>;
  latestAssistantReply?: string;
};

async function executeGatewayAgentSessions(args: {
  organizationId: string;
  teamId: string;
  teamName: string;
  desiredOutcome?: string | null;
  runId: string;
  reason: string;
  runObjective?: string | null;
}): Promise<GatewayAgentExecution[]> {
  const runtime = await prisma.agentRuntime.findFirst({
    where: {
      teamId: args.teamId,
      status: AgentRuntimeStatus.READY
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!runtime) {
    return [];
  }

  const gateway = await createGatewayClientForRuntime({
    organizationId: args.organizationId,
    runtime
  });

  if (!gateway) {
    return [];
  }

  const agents = await prisma.agent.findMany({
    where: {
      teamId: args.teamId,
      providerSessionId: {
        not: null
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const outputs: GatewayAgentExecution[] = [];
  const runtimeMetadata = toRecord(runtime.metadata);
  const teamRoster = agents.map((agent) => ({
    name: agent.name,
    role: agent.role,
    sessionKey: agent.providerSessionId ?? undefined
  }));

  for (const agent of agents) {
    if (!agent.providerSessionId) {
      continue;
    }

    const step = await prisma.agentRunStep.create({
      data: {
        runId: args.runId,
        agentId: agent.id,
        status: AgentRunStepStatus.RUNNING,
        kind: 'gateway-session',
        title: `Coordinate ${agent.name}`,
        detail: `Executing OpenClaw session ${agent.providerSessionId}.`,
        startedAt: new Date(),
        metadata: {
          sessionKey: agent.providerSessionId
        } as Prisma.InputJsonValue
      },
      select: {
        id: true
      }
    });

    try {
      await gateway.sendMessage({
        sessionKey: agent.providerSessionId,
        message: buildAgentExecutionPrompt({
          teamName: args.teamName,
          desiredOutcome: args.desiredOutcome,
          reason: args.reason,
          runObjective: args.runObjective,
          agentName: agent.name,
          agentRole: agent.role,
          agentGoal: agent.goal,
          systemPrompt: agent.systemPrompt,
          runtimeControlUrl: runtime.controlUrl,
          workspaceBriefPath:
            (runtimeMetadata.desktopBriefPath as string | undefined) ?? undefined,
          teamRoster
        })
      });

      await sleep(1_000);

      const transcript = await gateway.getHistory(agent.providerSessionId);
      const latestAssistantReply = getLatestAssistantReply(transcript);

      await prisma.agentRunStep.update({
        where: {
          id: step.id
        },
        data: {
          status: AgentRunStepStatus.SUCCEEDED,
          completedAt: new Date(),
          output: {
            sessionKey: agent.providerSessionId,
            transcriptLength: transcript.length,
            latestAssistantReply
          } as Prisma.InputJsonValue
        }
      });

      outputs.push({
        agentId: agent.id,
        agentName: agent.name,
        sessionKey: agent.providerSessionId,
        transcript,
        latestAssistantReply
      });
    } catch (error) {
      MonitoringProvider.captureError(error);

      await prisma.agentRunStep.update({
        where: {
          id: step.id
        },
        data: {
          status: AgentRunStepStatus.FAILED,
          completedAt: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          } as Prisma.InputJsonValue
        }
      });
    }
  }

  return outputs;
}

async function createGatewayArtifacts(args: {
  organizationId: string;
  teamId: string;
  runId: string;
  outputs: GatewayAgentExecution[];
}): Promise<void> {
  if (args.outputs.length === 0) {
    return;
  }

  const textContent = args.outputs
    .map((output) =>
      [
        `## ${output.agentName}`,
        output.latestAssistantReply ?? 'No assistant reply yet.'
      ].join('\n\n')
    )
    .join('\n\n');

  await prisma.agentArtifact.create({
    data: {
      organizationId: args.organizationId,
      teamId: args.teamId,
      runId: args.runId,
      type: AgentArtifactType.REPORT,
      title: 'OpenClaw coordination summary',
      textContent,
      metadata: {
        generatedBy: 'openclaw',
        agentCount: args.outputs.length
      } as Prisma.InputJsonValue
    }
  });

  await prisma.memoryEntry.createMany({
    data: args.outputs
      .filter((output) => Boolean(output.latestAssistantReply))
      .map((output) => ({
        organizationId: args.organizationId,
        teamId: args.teamId,
        runId: args.runId,
        agentId: output.agentId,
        kind: MemoryEntryKind.OBSERVATION,
        title: `${output.agentName} session summary`,
        content: output.latestAssistantReply ?? '',
        score: 0.7,
        source: 'openclaw'
      }))
  });
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

  const trigger =
    parsed.reason === 'scheduled'
      ? AgentRunTrigger.SCHEDULE
      : parsed.reason.startsWith('telegram:')
        ? AgentRunTrigger.WEBHOOK
        : AgentRunTrigger.MANUAL;
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
        trigger,
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

  const supervisionStep = await prisma.agentRunStep.create({
    data: {
      runId: run.id,
      status: AgentRunStepStatus.RUNNING,
      kind: 'supervision',
      title: 'Coordinate team execution',
      detail: `Supervisor run started because: ${parsed.reason}.`,
      startedAt: new Date()
    },
    select: {
      id: true
    }
  });

  try {
    await maybeSyncGatewaySessions(team.id, team.organizationId);
  } catch (error) {
    MonitoringProvider.captureError(error);
  }

  const gatewayOutputs = await executeGatewayAgentSessions({
    organizationId: team.organizationId,
    teamId: team.id,
    teamName: team.name,
    desiredOutcome: team.desiredOutcome,
    runId: run.id,
    reason: parsed.reason,
    runObjective: run.objective
  });

  await createGatewayArtifacts({
    organizationId: team.organizationId,
    teamId: team.id,
    runId: run.id,
    outputs: gatewayOutputs
  });

  const isInteractiveControlRun = parsed.reason.startsWith('telegram:');
  const artifacts =
    team.template === AgentTeamTemplate.TIKTOK_MARKETING &&
    !isInteractiveControlRun
      ? await createTikTokArtifacts(run.id, team.id)
      : [];

  const approvalPolicy = normalizeApprovalPolicy(team.approvalPolicy);
  let nextRunStatus: AgentRunStatus = AgentRunStatus.SUCCEEDED;
  const approvalWaitingUntil = new Date(Date.now() + 1000 * 60 * 60 * 24);

  if (approvalPolicy.requireApprovalForPublish && artifacts.length > 0) {
    const videoArtifact = artifacts.find(
      (artifact) => artifact.type === AgentArtifactType.VIDEO
    );

    const approvalRequest = await prisma.approvalRequest.create({
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

    await sendAgentJob(
      AgentJobName.ResolveApprovalTimeout,
      {
        organizationId: team.organizationId,
        approvalRequestId: approvalRequest.id
      },
      {
        startAfter: approvalWaitingUntil
      }
    );

    nextRunStatus = AgentRunStatus.WAITING_APPROVAL;
  }

  await prisma.agentRunStep.update({
    where: {
      id: supervisionStep.id
    },
    data: {
      status: AgentRunStepStatus.SUCCEEDED,
      completedAt: new Date(),
      detail:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? 'OpenClaw session outputs recorded and waiting for approval.'
          : 'OpenClaw session outputs recorded successfully.',
      output: {
        sessionCount: gatewayOutputs.length,
        artifactCount: artifacts.length,
        waitingForApproval: nextRunStatus === AgentRunStatus.WAITING_APPROVAL
      } as Prisma.InputJsonValue
    }
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      summary:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? 'Artifacts generated from OpenClaw activity and queued for approval.'
          : gatewayOutputs.length > 0
            ? 'OpenClaw sessions completed and the run finished successfully.'
            : 'Run completed successfully.',
      status: nextRunStatus,
      completedAt:
        nextRunStatus === AgentRunStatus.SUCCEEDED ? new Date() : null,
      waitingUntil:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? approvalWaitingUntil
          : null
    }
  });

  await prisma.agentTeam.update({
    where: { id: team.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: team.cadenceCron
        ? new Date(Date.now() + 1000 * 60 * 60 * 6)
        : null,
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
      artifactCount: artifacts.length,
      sessionCount: gatewayOutputs.length
    }
  });

  await notifyTeam({
    teamId: team.id,
    text:
      nextRunStatus === AgentRunStatus.WAITING_APPROVAL
        ? `Run completed for ${team.name} and is waiting for approval.`
        : `Run completed for ${team.name}. Sessions executed: ${gatewayOutputs.length}.`
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

    await notifyTeam({
      teamId: artifact.team.id,
      text: 'Publishing is blocked until a TikTok account is connected.'
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

    await notifyTeam({
      teamId: artifact.team.id,
      text: 'Publishing failed because the video artifact is missing a URL.'
    });

    return;
  }

  const publisher = createTikTokPublisherClient();
  const accessToken = await decryptSecret(
    tiktokConnection.encryptedAccessToken
  );
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

  await notifyTeam({
    teamId: artifact.team.id,
    text: `Publishing initialized for ${artifact.title}.`
  });
}

async function handleTelegramProviderWebhook(
  parsed: ProcessProviderWebhookJobPayload
): Promise<void> {
  if (!parsed.organizationId || !parsed.teamId || !parsed.channelId) {
    return;
  }

  const incomingText = parsed.payload.text;

  if (typeof incomingText !== 'string' || incomingText.trim().length === 0) {
    return;
  }

  await markControlChannelInbound(parsed.channelId);

  const team = await prisma.agentTeam.findUnique({
    where: {
      id: parsed.teamId
    },
    include: {
      runtimes: {
        where: {
          status: AgentRuntimeStatus.READY
        },
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

  const runtime =
    (parsed.runtimeId
      ? await prisma.agentRuntime.findUnique({
          where: {
            id: parsed.runtimeId
          }
        })
      : null) ?? team.runtimes[0];

  if (!runtime) {
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: `The team ${team.name} does not have a ready runtime yet.`
    });
    return;
  }

  await maybeSyncGatewaySessions(team.id, team.organizationId, runtime.id);

  const agents = await prisma.agent.findMany({
    where: {
      teamId: team.id,
      providerSessionId: {
        not: null
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const supervisor =
    agents.find(
      (agent) => agent.role === AgentRole.SUPERVISOR && agent.providerSessionId
    ) ?? agents.find((agent) => agent.providerSessionId);

  if (!supervisor?.providerSessionId) {
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: `The team ${team.name} is deployed, but no active OpenClaw session is available yet.`
    });
    return;
  }

  const gateway = await createGatewayClientForRuntime({
    organizationId: team.organizationId,
    runtime
  });

  if (!gateway) {
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: 'OpenClaw is not reachable for this team right now.'
    });
    return;
  }

  const run = await prisma.agentRun.create({
    data: {
      organizationId: team.organizationId,
      teamId: team.id,
      runtimeId: runtime.id,
      status: AgentRunStatus.RUNNING,
      trigger: AgentRunTrigger.WEBHOOK,
      title: 'Telegram control message',
      objective: incomingText,
      startedAt: new Date(),
      metadata: parsed.payload as Prisma.InputJsonValue
    },
    select: {
      id: true
    }
  });

  const step = await prisma.agentRunStep.create({
    data: {
      runId: run.id,
      agentId: supervisor.id,
      status: AgentRunStepStatus.RUNNING,
      kind: 'telegram-control',
      title: `Reply to Telegram from ${supervisor.name}`,
      detail: `Processing inbound Telegram control message for ${team.name}.`,
      startedAt: new Date(),
      metadata: {
        channelId: parsed.channelId,
        sessionKey: supervisor.providerSessionId
      } as Prisma.InputJsonValue
    },
    select: {
      id: true
    }
  });

  try {
    await gateway.sendMessage({
      sessionKey: parsed.sessionKey ?? supervisor.providerSessionId,
      message: `Telegram operator request:\n${incomingText.trim()}`
    });

    await sleep(1_000);

    const history = await gateway.getHistory(
      parsed.sessionKey ?? supervisor.providerSessionId
    );
    const latestAssistantReply =
      getLatestAssistantReply(history) ?? 'Message delivered to the team.';

    await notifyControlChannelWithTranscript({
      channelId: parsed.channelId,
      entries: history
    });

    await prisma.agentRunStep.update({
      where: {
        id: step.id
      },
      data: {
        status: AgentRunStepStatus.SUCCEEDED,
        completedAt: new Date(),
        output: {
          latestAssistantReply,
          transcriptLength: history.length
        } as Prisma.InputJsonValue
      }
    });

    await prisma.agentRun.update({
      where: {
        id: run.id
      },
      data: {
        status: AgentRunStatus.SUCCEEDED,
        summary: latestAssistantReply,
        completedAt: new Date()
      }
    });

    await createAgentAuditLog({
      organizationId: team.organizationId,
      teamId: team.id,
      runId: run.id,
      actorAgentId: supervisor.id,
      eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
      summary: `Processed Telegram control message for ${team.name}.`,
      metadata: {
        channelId: parsed.channelId,
        sessionKey: parsed.sessionKey ?? supervisor.providerSessionId
      }
    });
  } catch (error) {
    MonitoringProvider.captureError(error);

    await prisma.agentRunStep.update({
      where: {
        id: step.id
      },
      data: {
        status: AgentRunStepStatus.FAILED,
        completedAt: new Date(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error'
        } as Prisma.InputJsonValue
      }
    });

    await prisma.agentRun.update({
      where: {
        id: run.id
      },
      data: {
        status: AgentRunStatus.FAILED,
        summary: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date()
      }
    });

    await notifyControlChannel({
      channelId: parsed.channelId,
      text: `The Telegram request could not be processed: ${error instanceof Error ? error.message : 'Unknown error'}.`
    });
  }
}

async function handleProcessProviderWebhookJob(
  payload: unknown
): Promise<void> {
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

  if (parsed.provider === 'telegram') {
    await handleTelegramProviderWebhook(parsed);
    return;
  }

  if (!parsed.organizationId) {
    return;
  }

  const runtimeFromDeployment = parsed.deploymentId
    ? (
        await prisma.agentDeployment.findUnique({
          where: {
            id: parsed.deploymentId
          },
          select: {
            runtime: true
          }
        })
      )?.runtime
    : null;

  const runtime =
    (parsed.runtimeId
      ? await prisma.agentRuntime.findUnique({
          where: {
            id: parsed.runtimeId
          }
        })
      : null) ?? runtimeFromDeployment;

  const team =
    (parsed.teamId
      ? await prisma.agentTeam.findUnique({
          where: {
            id: parsed.teamId
          }
        })
      : null) ??
    (runtime
      ? await prisma.agentTeam.findUnique({
          where: {
            id: runtime.teamId
          }
        })
      : null) ??
    (await prisma.agentTeam.findFirst({
      where: {
        organizationId: parsed.organizationId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }));

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

  const runtimeToReconcile =
    runtime ??
    (await prisma.agentRuntime.findFirst({
      where: {
        organizationId: parsed.organizationId,
        teamId: team.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    }));

  if (runtimeToReconcile) {
    await sendAgentJob(AgentJobName.ReconcileRuntime, {
      organizationId: runtimeToReconcile.organizationId,
      teamId: runtimeToReconcile.teamId,
      runtimeId: runtimeToReconcile.id
    });
  }
}

async function handleResolveApprovalTimeoutJob(
  payload: unknown
): Promise<void> {
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

  await notifyTeam({
    teamId: request.teamId,
    text: `Approval expired: ${request.title}.`
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
