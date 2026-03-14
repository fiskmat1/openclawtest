import { Buffer } from 'node:buffer';
import { setTimeout as sleep } from 'node:timers/promises';
import type PgBoss from 'pg-boss';
import { Sandbox } from '@e2b/desktop';

import {
  AgentJobName,
  createOpenAIComputerUseSupervisorClient,
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
  notifyTeamControlChannels
} from './lib/control-channels';
import {
  buildAgentExecutionPrompt,
  getLatestAssistantReply
} from './lib/gateway';
import { getNextRunAt } from './lib/scheduling';
import { runSupervisorLoop } from './lib/supervisor';

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

async function getOpenAIApiKeyForOrganization(
  organizationId: string
): Promise<string | undefined> {
  const connection = await getConnectedProviderConnection(
    organizationId,
    ProviderConnectionType.OPENAI
  );

  if (connection?.encryptedAccessToken) {
    return decryptSecret(connection.encryptedAccessToken);
  }

  return agentKeys().AGENTS_OPENAI_API_KEY;
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
  const runtimeMetadata = toRecord(runtime.metadata);
  const shouldOpenBrief =
    runtimeMetadata.desktopBootstrappedRuntimeId !== runtime.externalRuntimeId;
  const bootstrappedAt = new Date().toISOString();
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

  if (shouldOpenBrief) {
    try {
      await sandbox.launch('google-chrome', `file://${briefPath}`);
    } catch {
      await sandbox.open(briefPath);
    }
  }

  await prisma.agentRuntime.update({
    where: {
      id: runtime.id
    },
    data: {
      metadata: {
        ...runtimeMetadata,
        desktopBriefPath: briefPath,
        desktopBriefUpdatedAt: bootstrappedAt,
        ...(shouldOpenBrief
          ? {
              desktopBootstrappedAt: bootstrappedAt,
              desktopBootstrappedRuntimeId: runtime.externalRuntimeId
            }
          : {})
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

const RUNTIME_LOCK_TTL_MS = 1000 * 60 * 10;
const SUPERVISOR_TICK_INTERVAL_MS = 1000 * 60 * 5;
const RUNTIME_HEARTBEAT_INTERVAL_MS = 1000 * 60 * 5;
const STALE_RUNNING_RUN_THRESHOLD_MS = 1000 * 60 * 20;

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

async function acquireRuntimeLock(runtimeId: string): Promise<string | null> {
  const lockKey = crypto.randomUUID();
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + RUNTIME_LOCK_TTL_MS);
  const result = await prisma.agentRuntime.updateMany({
    where: {
      id: runtimeId,
      OR: [
        {
          lockExpiresAt: null
        },
        {
          lockExpiresAt: {
            lt: now
          }
        }
      ]
    },
    data: {
      lockKey,
      lockExpiresAt
    }
  });

  return result.count > 0 ? lockKey : null;
}

async function releaseRuntimeLock(
  runtimeId: string,
  lockKey: string | null | undefined
): Promise<void> {
  if (!lockKey) {
    return;
  }

  await prisma.agentRuntime.updateMany({
    where: {
      id: runtimeId,
      lockKey
    },
    data: {
      lockKey: null,
      lockExpiresAt: null
    }
  });
}

async function scheduleRuntimeHeartbeat(args: {
  organizationId: string;
  teamId: string;
  runtimeId: string;
  delayMs?: number;
}): Promise<void> {
  await sendAgentJob(
    AgentJobName.HeartbeatRuntime,
    {
      organizationId: args.organizationId,
      teamId: args.teamId,
      runtimeId: args.runtimeId
    },
    {
      startAfter: new Date(
        Date.now() + (args.delayMs ?? RUNTIME_HEARTBEAT_INTERVAL_MS)
      ),
      singletonKey: `heartbeat:${args.runtimeId}`
    }
  );
}

async function scheduleSupervisorTick(args: {
  organizationId: string;
  teamId: string;
  runtimeId?: string;
  reason: string;
  delayMs?: number;
}): Promise<void> {
  await sendAgentJob(
    AgentJobName.SupervisorTick,
    {
      organizationId: args.organizationId,
      teamId: args.teamId,
      runtimeId: args.runtimeId,
      reason: args.reason
    },
    {
      startAfter: new Date(
        Date.now() + (args.delayMs ?? SUPERVISOR_TICK_INTERVAL_MS)
      ),
      singletonKey: `supervisor:${args.teamId}`
    }
  );
}

function formatStructuredList(title: string, values: string[]): string {
  if (values.length === 0) {
    return `${title}: none`;
  }

  return `${title}:\n- ${values.join('\n- ')}`;
}

async function buildSupervisorTask(args: {
  team: {
    id: string;
    name: string;
    desiredOutcome: string | null;
    promptPack: Prisma.JsonValue | null;
    teamSpec: Prisma.JsonValue | null;
    supervisorConfig: Prisma.JsonValue | null;
  };
  runtime: {
    id: string;
    controlUrl: string | null;
    metadata: Prisma.JsonValue | null;
    supervisorState: Prisma.JsonValue | null;
  };
  run: {
    id: string;
    objective: string | null;
  };
  reason: string;
  operatorMessage?: string;
}): Promise<string> {
  const [recentMemories, recentArtifacts, pendingApprovals] = await Promise.all([
    prisma.memoryEntry.findMany({
      where: {
        teamId: args.team.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        title: true,
        content: true,
        kind: true
      }
    }),
    prisma.agentArtifact.findMany({
      where: {
        teamId: args.team.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3,
      select: {
        title: true,
        type: true,
        textContent: true,
        url: true
      }
    }),
    prisma.approvalRequest.findMany({
      where: {
        teamId: args.team.id,
        status: ApprovalRequestStatus.PENDING
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3,
      select: {
        id: true,
        title: true,
        description: true
      }
    })
  ]);
  const teamSpec = toRecord(args.team.teamSpec);
  const supervisorState = toRecord(args.runtime.supervisorState);
  const promptPack = toRecord(args.team.promptPack);
  const supervisorPrompt =
    typeof promptPack.supervisor === 'string' ? promptPack.supervisor : undefined;
  const shouldForceVisibleAction =
    typeof supervisorState.lastActionCount !== 'number' ||
    supervisorState.lastActionCount === 0;
  const previousSupervisorSummary =
    typeof supervisorState.lastOutput === 'string'
      ? truncateText(supervisorState.lastOutput, shouldForceVisibleAction ? 180 : 320)
      : 'none';
  const memorySummary = recentMemories
    .slice(0, shouldForceVisibleAction ? 2 : 3)
    .map((entry) =>
      truncateText(
        `${entry.kind.toLowerCase()}: ${entry.title} - ${entry.content}`,
        180
      )
    );
  const artifactSummary = recentArtifacts
    .slice(0, shouldForceVisibleAction ? 2 : 3)
    .map((artifact) =>
      truncateText(
        `${artifact.type.toLowerCase()}: ${artifact.title}${
          artifact.url ? ` (${artifact.url})` : ''
        }${artifact.textContent ? ` - ${artifact.textContent}` : ''}`,
        180
      )
    );
  const approvalSummary = pendingApprovals.map((approval) =>
    truncateText(
      `${approval.id}: ${approval.title}${
        approval.description ? ` - ${approval.description}` : ''
      }`,
      180
    )
  );

  return [
    shouldForceVisibleAction
      ? 'Computer-use objective: take at least one safe desktop action before any text summary. Your first response should be a computer action, not only prose.'
      : 'Computer-use objective: continue advancing the desktop state with concrete actions when useful.',
    `Run reason: ${args.reason}`,
    `Team: ${args.team.name}`,
    `Desired outcome: ${args.team.desiredOutcome ?? 'No desired outcome recorded.'}`,
    `Run objective: ${args.run.objective ?? 'No explicit objective recorded.'}`,
    `Runtime live view: ${args.runtime.controlUrl ?? 'Unavailable'}`,
    `Desktop brief: ${
      (toRecord(args.runtime.metadata).desktopBriefPath as string | undefined) ??
      'Unavailable'
    }`,
    `Mission: ${
      typeof teamSpec.mission === 'string'
        ? teamSpec.mission
        : 'Operate continuously and coordinate the specialist mesh.'
    }`,
    args.operatorMessage
      ? `Latest operator message: ${args.operatorMessage}`
      : 'Latest operator message: none',
    formatStructuredList('Recent memory', memorySummary),
    formatStructuredList('Recent artifacts', artifactSummary),
    formatStructuredList('Pending approvals', approvalSummary),
    `Previous supervisor summary: ${previousSupervisorSummary}`,
    'Use the E2B desktop to inspect the live runtime and gather visual context before acting.',
    shouldForceVisibleAction
      ? 'If the desktop is already on the runtime brief, move the UI forward: scroll, switch tabs, open a terminal, inspect a file, or verify a deliverable from the desktop.'
      : 'Prefer concrete desktop actions over restating the desktop brief when it is safe to continue.',
    'Reuse the current desktop state when possible. Do not reopen the same brief page or duplicate tabs unless the sandbox has changed.',
    'Then produce a concise supervisor directive for the OpenClaw specialist mesh, along with a short operator-facing status update.',
    'If the next action would create external risk, stop and explain exactly what approval is required.',
    supervisorPrompt ? `Supervisor instructions:\n${supervisorPrompt}` : ''
  ]
    .filter((line) => line.length > 0)
    .join('\n\n');
}

async function createSupervisorArtifacts(args: {
  organizationId: string;
  teamId: string;
  runId: string;
  summary: string;
  actionCount: number;
}): Promise<void> {
  if (args.summary.trim().length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.agentArtifact.create({
      data: {
        organizationId: args.organizationId,
        teamId: args.teamId,
        runId: args.runId,
        type: AgentArtifactType.REPORT,
        title: 'Computer-use supervisor summary',
        textContent: args.summary,
        metadata: {
          generatedBy: 'openai-computer-use',
          actionCount: args.actionCount
        } as Prisma.InputJsonValue
      }
    }),
    prisma.memoryEntry.create({
      data: {
        organizationId: args.organizationId,
        teamId: args.teamId,
        runId: args.runId,
        kind: MemoryEntryKind.OBSERVATION,
        title: 'Supervisor loop summary',
        content: truncateText(args.summary, 4000),
        score: 0.75,
        source: 'openai-computer-use'
      }
    })
  ]);
}

async function createSupervisorApprovalRequest(args: {
  organizationId: string;
  teamId: string;
  runId: string;
  reason: string;
  safetyChecks: Array<{
    id: string;
    code?: string;
    message?: string;
  }>;
}): Promise<void> {
  if (args.safetyChecks.length === 0) {
    return;
  }

  await prisma.approvalRequest.create({
    data: {
      organizationId: args.organizationId,
      teamId: args.teamId,
      runId: args.runId,
      kind: ApprovalRequestKind.EXTERNAL_POST,
      status: ApprovalRequestStatus.PENDING,
      riskLevel: ApprovalRiskLevel.HIGH,
      title: 'Supervisor confirmation required',
      description: `The computer-use supervisor paused because additional confirmation is required during ${args.reason}.`,
      requestedAction: {
        source: 'openai-computer-use',
        reason: args.reason,
        safetyChecks: args.safetyChecks
      } as Prisma.InputJsonValue
    }
  });
}

async function runComputerUseSupervisor(args: {
  organizationId: string;
  team: {
    id: string;
    name: string;
    desiredOutcome: string | null;
    promptPack: Prisma.JsonValue | null;
    teamSpec: Prisma.JsonValue | null;
    supervisorConfig: Prisma.JsonValue | null;
  };
  runtime: {
    id: string;
    externalRuntimeId: string | null;
    controlUrl: string | null;
    metadata: Prisma.JsonValue | null;
    supervisorState: Prisma.JsonValue | null;
  };
  run: {
    id: string;
    objective: string | null;
  };
  reason: string;
  operatorMessage?: string;
}): Promise<{
  summary?: string;
  actionCount: number;
  pendingSafetyChecks: Array<{
    id: string;
    code?: string;
    message?: string;
  }>;
}> {
  if (!args.runtime.externalRuntimeId) {
    return {
      actionCount: 0,
      pendingSafetyChecks: []
    };
  }

  const [e2bApiKey, openAiApiKey] = await Promise.all([
    getE2BApiKeyForOrganization(args.organizationId),
    getOpenAIApiKeyForOrganization(args.organizationId)
  ]);

  if (!e2bApiKey || !openAiApiKey) {
    return {
      actionCount: 0,
      pendingSafetyChecks: []
    };
  }

  const supervisorConfig = toRecord(args.team.supervisorConfig);
  const runtimeState = toRecord(args.runtime.supervisorState);
  const task = await buildSupervisorTask({
    team: args.team,
    runtime: args.runtime,
    run: args.run,
    reason: args.reason,
    operatorMessage: args.operatorMessage
  });
  const systemPrompt =
    typeof toRecord(args.team.promptPack).supervisor === 'string'
      ? String(toRecord(args.team.promptPack).supervisor)
      : 'You are the always-on computer-use supervisor for this team.';
  const maxTurns =
    typeof supervisorConfig.maxTurnsPerTick === 'number'
      ? supervisorConfig.maxTurnsPerTick
      : 8;
  const supervisor = createOpenAIComputerUseSupervisorClient({
    apiKey: openAiApiKey,
    model:
      typeof supervisorConfig.model === 'string'
        ? supervisorConfig.model
        : undefined
  });
  let result = await runSupervisorLoop({
    sandboxId: args.runtime.externalRuntimeId,
    e2bApiKey,
    supervisor,
    task,
    systemPrompt,
    previousResponseId:
      typeof runtimeState.previousResponseId === 'string'
        ? runtimeState.previousResponseId
        : undefined,
    maxTurns,
    autoAcknowledgeSafetyChecks: false,
    metadata: {
      teamId: args.team.id,
      runtimeId: args.runtime.id,
      runId: args.run.id
    }
  });

  if (result.actionCount === 0 && result.pendingSafetyChecks.length === 0) {
    result = await runSupervisorLoop({
      sandboxId: args.runtime.externalRuntimeId,
      e2bApiKey,
      supervisor,
      task: [
        task,
        'The previous supervisor attempt did not take any computer actions.',
        'You must take at least one safe desktop action in this retry before responding.',
        'Examples: switch tabs, open a terminal, inspect a file, or navigate to the relevant on-screen resource.',
        'Do not only summarize the current brief.'
      ].join('\n\n'),
      systemPrompt,
      maxTurns: Math.max(1, Math.min(maxTurns, 4)),
      autoAcknowledgeSafetyChecks: false,
      metadata: {
        teamId: args.team.id,
        runtimeId: args.runtime.id,
        runId: args.run.id,
        retry: 'forced-visible-action'
      }
    });
  }

  await prisma.agentRuntime.update({
    where: {
      id: args.runtime.id
    },
    data: {
      lastHeartbeatAt: new Date(),
      supervisorState: {
        ...runtimeState,
        previousResponseId: result.actionCount > 0 ? result.responseId : null,
        lastOutput: result.outputText,
        lastSupervisorAt: new Date().toISOString(),
        lastActionCount: result.actionCount
      } as Prisma.InputJsonValue
    }
  });

  if (result.outputText) {
    await createSupervisorArtifacts({
      organizationId: args.organizationId,
      teamId: args.team.id,
      runId: args.run.id,
      summary: result.outputText,
      actionCount: result.actionCount
    });
  }

  if (result.pendingSafetyChecks.length > 0) {
    await createSupervisorApprovalRequest({
      organizationId: args.organizationId,
      teamId: args.team.id,
      runId: args.run.id,
      reason: args.reason,
      safetyChecks: result.pendingSafetyChecks
    });
  }

  return {
    summary: result.outputText,
    actionCount: result.actionCount,
    pendingSafetyChecks: result.pendingSafetyChecks
  };
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
      await scheduleRuntimeHeartbeat({
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        runtimeId: runtime.id,
        delayMs: 30_000
      });
      await sendAgentJob(AgentJobName.SuperviseTeam, {
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        reason: 'deployment-bootstrap'
      });
      await scheduleSupervisorTick({
        organizationId: deployment.organizationId,
        teamId: deployment.teamId,
        runtimeId: runtime.id,
        reason: 'continuous',
        delayMs: SUPERVISOR_TICK_INTERVAL_MS
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
    await bootstrapRuntimeDesktop({
      organizationId: runtime.organizationId,
      runtimeId: runtime.id,
      teamId: runtime.teamId
    });
    await scheduleRuntimeHeartbeat({
      organizationId: runtime.organizationId,
      teamId: runtime.teamId,
      runtimeId: runtime.id
    });
    await scheduleSupervisorTick({
      organizationId: runtime.organizationId,
      teamId: runtime.teamId,
      runtimeId: runtime.id,
      reason: 'continuous'
    });
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
        desiredOutcome: true,
        status: true
      }
    }),
    prisma.agent.findMany({
      where: { teamId }
    })
  ]);

  if (!team) {
    return;
  }

  if (
    team.status === AgentTeamStatus.PAUSED ||
    team.status === AgentTeamStatus.ARCHIVED
  ) {
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

  const runtime = team.runtimes[0] ?? null;
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
        runtimeId: runtime?.id ?? null,
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
  const normalizedRun =
    run.status === AgentRunStatus.RUNNING
      ? run
      : await prisma.agentRun.update({
          where: {
            id: run.id
          },
          data: {
            runtimeId: runtime?.id ?? run.runtimeId,
            status: AgentRunStatus.RUNNING,
            startedAt: run.startedAt ?? new Date(),
            failedAt: null,
            completedAt: null,
            waitingUntil: null
          }
        });

  if (!runtime) {
    await prisma.agentRun.update({
      where: {
        id: normalizedRun.id
      },
      data: {
        status: AgentRunStatus.QUEUED,
        summary: 'No runtime is ready yet. Recovery has been queued.'
      }
    });

    await sendAgentJob(AgentJobName.RecoverTeam, {
      organizationId: team.organizationId,
      teamId: team.id,
      reason: 'missing-runtime'
    });

    return;
  }

  const lockKey = await acquireRuntimeLock(runtime.id);
  if (!lockKey) {
    await scheduleSupervisorTick({
      organizationId: team.organizationId,
      teamId: team.id,
      runtimeId: runtime.id,
      reason: 'lock-contention',
      delayMs: 60_000
    });
    return;
  }

  const supervisionStep = await prisma.agentRunStep.create({
    data: {
      runId: normalizedRun.id,
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
    await maybeSyncGatewaySessions(team.id, team.organizationId, runtime.id);

    const supervisorResult = await runComputerUseSupervisor({
      organizationId: team.organizationId,
      team: {
        id: team.id,
        name: team.name,
        desiredOutcome: team.desiredOutcome,
        promptPack: team.promptPack,
        teamSpec: team.teamSpec,
        supervisorConfig: team.supervisorConfig
      },
      runtime: {
        id: runtime.id,
        externalRuntimeId: runtime.externalRuntimeId,
        controlUrl: runtime.controlUrl,
        metadata: runtime.metadata,
        supervisorState: runtime.supervisorState
      },
      run: {
        id: normalizedRun.id,
        objective: normalizedRun.objective
      },
      reason: parsed.reason
    });
    const effectiveObjective = [
      normalizedRun.objective,
      supervisorResult.summary
        ? `Supervisor directive:\n${supervisorResult.summary}`
        : null
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');
    const gatewayOutputs =
      supervisorResult.pendingSafetyChecks.length > 0
        ? []
        : await executeGatewayAgentSessions({
            organizationId: team.organizationId,
            teamId: team.id,
            teamName: team.name,
            desiredOutcome: team.desiredOutcome,
            runId: normalizedRun.id,
            reason: parsed.reason,
            runObjective: effectiveObjective
          });

    await createGatewayArtifacts({
      organizationId: team.organizationId,
      teamId: team.id,
      runId: normalizedRun.id,
      outputs: gatewayOutputs
    });

    const isInteractiveControlRun = parsed.reason.startsWith('telegram:');
    const artifacts =
      team.template === AgentTeamTemplate.TIKTOK_MARKETING &&
      !isInteractiveControlRun &&
      supervisorResult.pendingSafetyChecks.length === 0
        ? await createTikTokArtifacts(normalizedRun.id, team.id)
        : [];

    const approvalPolicy = normalizeApprovalPolicy(team.approvalPolicy);
    let nextRunStatus: AgentRunStatus =
      supervisorResult.pendingSafetyChecks.length > 0
        ? AgentRunStatus.WAITING_APPROVAL
        : AgentRunStatus.SUCCEEDED;
    const approvalWaitingUntil = new Date(Date.now() + 1000 * 60 * 60 * 24);

    if (
      nextRunStatus !== AgentRunStatus.WAITING_APPROVAL &&
      approvalPolicy.requireApprovalForPublish &&
      artifacts.length > 0
    ) {
      const videoArtifact = artifacts.find(
        (artifact) => artifact.type === AgentArtifactType.VIDEO
      );

      const approvalRequest = await prisma.approvalRequest.create({
        data: {
          organizationId: team.organizationId,
          teamId: team.id,
          runId: normalizedRun.id,
          kind: ApprovalRequestKind.PUBLISH_CONTENT,
          status: ApprovalRequestStatus.PENDING,
          riskLevel: ApprovalRiskLevel.HIGH,
          title: `Approve publishing for ${team.name}`,
          description:
            'Review the generated artifacts and approve when you are ready to publish through TikTok.',
          requestedAction: {
            artifactId: videoArtifact?.id,
            runId: normalizedRun.id,
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
            ? 'Supervisor output recorded and waiting for approval.'
            : 'Supervisor output and OpenClaw session outputs recorded successfully.',
        output: {
          supervisorActionCount: supervisorResult.actionCount,
          supervisorSummary: supervisorResult.summary,
          safetyCheckCount: supervisorResult.pendingSafetyChecks.length,
          sessionCount: gatewayOutputs.length,
          artifactCount: artifacts.length,
          waitingForApproval: nextRunStatus === AgentRunStatus.WAITING_APPROVAL
        } as Prisma.InputJsonValue
      }
    });

    await prisma.agentRun.update({
      where: { id: normalizedRun.id },
      data: {
        objective: effectiveObjective || normalizedRun.objective,
        summary:
          nextRunStatus === AgentRunStatus.WAITING_APPROVAL
            ? supervisorResult.pendingSafetyChecks.length > 0
              ? 'Supervisor paused and is waiting for confirmation.'
              : 'Artifacts generated from OpenClaw activity and queued for approval.'
            : supervisorResult.summary ??
              (gatewayOutputs.length > 0
                ? 'OpenClaw sessions completed and the run finished successfully.'
                : 'Run completed successfully.'),
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
        nextRunAt: getNextRunAt(team.cadenceCron),
        status: AgentTeamStatus.ACTIVE
      }
    });

    await createAgentAuditLog({
      organizationId: team.organizationId,
      teamId: team.id,
      runId: normalizedRun.id,
      eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
      summary: `Run transitioned to ${nextRunStatus.toLowerCase()}.`,
      metadata: {
        trigger: parsed.reason,
        supervisorActionCount: supervisorResult.actionCount,
        safetyCheckCount: supervisorResult.pendingSafetyChecks.length,
        artifactCount: artifacts.length,
        sessionCount: gatewayOutputs.length
      }
    });

    await notifyTeam({
      teamId: team.id,
      text:
        nextRunStatus === AgentRunStatus.WAITING_APPROVAL
          ? `Run completed for ${team.name} and is waiting for approval.`
          : `Run completed for ${team.name}. Supervisor actions: ${supervisorResult.actionCount}. Sessions executed: ${gatewayOutputs.length}.`
    });

    if (
      team.status !== AgentTeamStatus.PAUSED &&
      team.status !== AgentTeamStatus.ARCHIVED
    ) {
      await scheduleSupervisorTick({
        organizationId: team.organizationId,
        teamId: team.id,
        runtimeId: runtime.id,
        reason: 'continuous'
      });
    }
  } catch (error) {
    MonitoringProvider.captureError(error);

    await prisma.agentRunStep.update({
      where: {
        id: supervisionStep.id
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
        id: normalizedRun.id
      },
      data: {
        status: AgentRunStatus.FAILED,
        summary: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date()
      }
    });

    await prisma.agentTeam.update({
      where: {
        id: team.id
      },
      data: {
        status: AgentTeamStatus.DEGRADED
      }
    });

    await sendAgentJob(AgentJobName.RecoverTeam, {
      organizationId: team.organizationId,
      teamId: team.id,
      runtimeId: runtime.id,
      reason: 'supervision-error'
    });

    await notifyTeam({
      teamId: team.id,
      text: `Supervision failed for ${team.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  } finally {
    await releaseRuntimeLock(runtime.id, lockKey);
  }
}

async function handleSupervisorTickJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.SupervisorTick, payload);
  const team = await prisma.agentTeam.findUnique({
    where: {
      id: parsed.teamId
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      runtimes: {
        where: {
          status: AgentRuntimeStatus.READY
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1,
        select: {
          id: true
        }
      }
    }
  });

  if (
    !team ||
    team.status === AgentTeamStatus.PAUSED ||
    team.status === AgentTeamStatus.ARCHIVED
  ) {
    return;
  }

  await prisma.agentRun.updateMany({
    where: {
      teamId: team.id,
      status: AgentRunStatus.RUNNING,
      updatedAt: {
        lt: new Date(Date.now() - STALE_RUNNING_RUN_THRESHOLD_MS)
      }
    },
    data: {
      status: AgentRunStatus.FAILED,
      summary: 'Run marked failed after becoming stale during worker recovery.',
      failedAt: new Date()
    }
  });

  const activeRun = await prisma.agentRun.findFirst({
    where: {
      teamId: team.id,
      status: {
        in: [AgentRunStatus.RUNNING, AgentRunStatus.WAITING_APPROVAL]
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true
    }
  });

  if (activeRun) {
    await scheduleSupervisorTick({
      organizationId: parsed.organizationId,
      teamId: parsed.teamId,
      runtimeId: parsed.runtimeId ?? team.runtimes[0]?.id,
      reason: parsed.reason,
      delayMs: SUPERVISOR_TICK_INTERVAL_MS
    });
    return;
  }

  if (!team.runtimes[0]?.id) {
    await sendAgentJob(AgentJobName.RecoverTeam, {
      organizationId: parsed.organizationId,
      teamId: parsed.teamId,
      reason: parsed.reason
    });
    return;
  }

  await handleSuperviseTeamJob({
    organizationId: parsed.organizationId,
    teamId: parsed.teamId,
    reason: `tick:${parsed.reason}`
  });
}

async function handleHeartbeatRuntimeJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.HeartbeatRuntime, payload);
  await handleReconcileRuntimeJob(parsed);

  const runtime = await prisma.agentRuntime.findUnique({
    where: {
      id: parsed.runtimeId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!runtime) {
    return;
  }

  if (runtime.status === AgentRuntimeStatus.READY) {
    await scheduleRuntimeHeartbeat(parsed);
    return;
  }

  await sendAgentJob(AgentJobName.RecoverTeam, {
    organizationId: parsed.organizationId,
    teamId: parsed.teamId,
    runtimeId: parsed.runtimeId,
    reason: 'heartbeat-unhealthy'
  });
}

async function handleRecoverTeamJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.RecoverTeam, payload);
  const team = await prisma.agentTeam.findUnique({
    where: {
      id: parsed.teamId
    },
    include: {
      runtimes: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  });

  if (!team || team.status === AgentTeamStatus.ARCHIVED) {
    return;
  }

  const runtime =
    (parsed.runtimeId
      ? await prisma.agentRuntime.findUnique({
          where: {
            id: parsed.runtimeId
          }
        })
      : null) ?? team.runtimes[0] ?? null;

  if (runtime) {
    await handleReconcileRuntimeJob({
      organizationId: parsed.organizationId,
      teamId: parsed.teamId,
      runtimeId: runtime.id
    });

    const refreshedRuntime = await prisma.agentRuntime.findUnique({
      where: {
        id: runtime.id
      },
      select: {
        id: true,
        status: true
      }
    });

    if (refreshedRuntime?.status === AgentRuntimeStatus.READY) {
      await scheduleSupervisorTick({
        organizationId: parsed.organizationId,
        teamId: parsed.teamId,
        runtimeId: refreshedRuntime.id,
        reason: 'recovered',
        delayMs: 15_000
      });
      return;
    }
  }

  const latestDeployment = await getLatestDeployment(parsed.teamId);
  if (
    latestDeployment &&
    latestDeployment.status !== AgentDeploymentStatus.FAILED &&
    latestDeployment.status !== AgentDeploymentStatus.STOPPED &&
    latestDeployment.status !== AgentDeploymentStatus.REDEPLOY_REQUIRED
  ) {
    return;
  }

  const providerConnection = await getConnectedProviderConnection(
    parsed.organizationId,
    ProviderConnectionType.E2B
  );

  if (!providerConnection) {
    return;
  }

  const deployment = await prisma.agentDeployment.create({
    data: {
      organizationId: parsed.organizationId,
      teamId: parsed.teamId,
      provider: AgentRuntimeProvider.E2B,
      providerConnectionId: providerConnection.id,
      status: AgentDeploymentStatus.QUEUED
    },
    select: {
      id: true
    }
  });

  await prisma.agentTeam.update({
    where: {
      id: parsed.teamId
    },
    data: {
      status: AgentTeamStatus.PROVISIONING
    }
  });

  await sendAgentJob(AgentJobName.DeployTeam, {
    organizationId: parsed.organizationId,
    teamId: parsed.teamId,
    deploymentId: deployment.id
  });
}

async function handleCleanupRuntimeJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.CleanupRuntime, payload);
  await prisma.agentRuntime.updateMany({
    where: {
      id: parsed.runtimeId
    },
    data: {
      lockKey: null,
      lockExpiresAt: null
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

  await sendAgentJob(
    AgentJobName.CheckPublishStatus,
    {
      organizationId: artifact.organizationId,
      artifactId: artifact.id,
      runId: artifact.runId ?? undefined
    },
    {
      startAfter: new Date(Date.now() + 60_000),
      singletonKey: `publish-status:${artifact.id}`
    }
  );
}

async function handleCheckPublishStatusJob(payload: unknown): Promise<void> {
  const parsed = parseAgentJobPayload(AgentJobName.CheckPublishStatus, payload);
  const artifact = await prisma.agentArtifact.findUnique({
    where: {
      id: parsed.artifactId
    },
    include: {
      team: true
    }
  });

  if (!artifact?.team || !artifact.externalId) {
    return;
  }

  const tiktokConnection = await getConnectedProviderConnection(
    artifact.organizationId,
    ProviderConnectionType.TIKTOK
  );

  if (!tiktokConnection?.encryptedAccessToken) {
    return;
  }

  const accessToken = await decryptSecret(tiktokConnection.encryptedAccessToken);
  const publishStatus = await createTikTokPublisherClient().getPublishStatus(
    artifact.externalId,
    accessToken
  );

  await prisma.agentArtifact.update({
    where: {
      id: artifact.id
    },
    data: {
      metadata: {
        ...toRecord(artifact.metadata),
        publishStatus: publishStatus.status,
        postId: publishStatus.postId,
        publishMetadata: publishStatus.metadata
      } as Prisma.InputJsonValue
    }
  });

  if (artifact.runId) {
    await prisma.agentRun.update({
      where: {
        id: artifact.runId
      },
      data: {
        status: publishStatus.status,
        summary:
          publishStatus.status === AgentRunStatus.SUCCEEDED
            ? 'TikTok publish completed successfully.'
            : publishStatus.status === AgentRunStatus.FAILED
              ? 'TikTok publish failed.'
              : 'TikTok publish is still in progress.',
        completedAt:
          publishStatus.status === AgentRunStatus.SUCCEEDED
            ? new Date()
            : null,
        failedAt:
          publishStatus.status === AgentRunStatus.FAILED ? new Date() : null
      }
    });
  }

  if (publishStatus.status === AgentRunStatus.RUNNING) {
    await sendAgentJob(
      AgentJobName.CheckPublishStatus,
      {
        organizationId: parsed.organizationId,
        artifactId: artifact.id,
        runId: artifact.runId ?? undefined
      },
      {
        startAfter: new Date(Date.now() + 60_000),
        singletonKey: `publish-status:${artifact.id}`
      }
    );
    return;
  }

  await notifyTeam({
    teamId: artifact.team.id,
    text:
      publishStatus.status === AgentRunStatus.SUCCEEDED
        ? `Publishing completed for ${artifact.title}.`
        : `Publishing failed for ${artifact.title}.`
  });
}

function parseTelegramCommand(input: string): {
  command: string;
  arg?: string;
} | null {
  const normalized = input.trim();
  if (!normalized.startsWith('/')) {
    return null;
  }

  const [command, ...rest] = normalized.slice(1).split(/\s+/);
  return {
    command: command.toLowerCase(),
    arg: rest.join(' ').trim() || undefined
  };
}

async function appendControlChannelHistory(args: {
  channelId: string;
  direction: 'inbound' | 'outbound';
  text: string;
}): Promise<void> {
  const channel = await prisma.agentControlChannel.findUnique({
    where: {
      id: args.channelId
    },
    select: {
      metadata: true
    }
  });

  const metadata = toRecord(channel?.metadata);
  const history = Array.isArray(metadata.history)
    ? metadata.history.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
  const nextHistory = [
    ...history,
    {
      direction: args.direction,
      text: truncateText(args.text, 1000),
      at: new Date().toISOString()
    }
  ].slice(-20);

  await prisma.agentControlChannel.update({
    where: {
      id: args.channelId
    },
    data: {
      metadata: {
        ...metadata,
        history: nextHistory
      } as Prisma.InputJsonValue
    }
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
  await appendControlChannelHistory({
    channelId: parsed.channelId,
    direction: 'inbound',
    text: incomingText
  });

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

  const command = parseTelegramCommand(incomingText);
  if (command?.command === 'pause') {
    await prisma.agentTeam.update({
      where: {
        id: team.id
      },
      data: {
        status: AgentTeamStatus.PAUSED
      }
    });
    const reply = `Paused autonomous activity for ${team.name}.`;
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: reply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: reply
    });
    return;
  }

  if (command?.command === 'resume') {
    await prisma.agentTeam.update({
      where: {
        id: team.id
      },
      data: {
        status: AgentTeamStatus.ACTIVE
      }
    });
    await scheduleSupervisorTick({
      organizationId: team.organizationId,
      teamId: team.id,
      runtimeId: team.runtimes[0]?.id,
      reason: 'telegram-resume',
      delayMs: 5_000
    });
    const reply = `Resumed autonomous activity for ${team.name}.`;
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: reply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: reply
    });
    return;
  }

  if (command?.command === 'status') {
    const latestRun = await prisma.agentRun.findFirst({
      where: {
        teamId: team.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        status: true,
        summary: true,
        updatedAt: true
      }
    });
    const reply = [
      `Team: ${team.name}`,
      `Status: ${team.status.toLowerCase()}`,
      `Runtime: ${team.runtimes[0] ? 'ready' : 'not ready'}`,
      latestRun
        ? `Latest run: ${latestRun.status.toLowerCase()} (${latestRun.updatedAt.toISOString()})`
        : 'Latest run: none',
      latestRun?.summary ? `Summary: ${truncateText(latestRun.summary, 500)}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: reply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: reply
    });
    return;
  }

  if (command?.command === 'summary') {
    const latestReport = await prisma.agentArtifact.findFirst({
      where: {
        teamId: team.id,
        type: AgentArtifactType.REPORT
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        title: true,
        textContent: true
      }
    });
    const reply = latestReport?.textContent
      ? `${latestReport.title}\n\n${truncateText(latestReport.textContent, 3000)}`
      : `No report is available yet for ${team.name}.`;
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: reply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: reply
    });
    return;
  }

  if (command?.command === 'approve' || command?.command === 'reject') {
    const approval = command.arg
      ? await prisma.approvalRequest.findFirst({
          where: {
            id: command.arg,
            teamId: team.id,
            status: ApprovalRequestStatus.PENDING
          }
        })
      : await prisma.approvalRequest.findFirst({
          where: {
            teamId: team.id,
            status: ApprovalRequestStatus.PENDING
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

    if (!approval) {
      const reply = 'No matching pending approval was found.';
      await notifyControlChannel({
        channelId: parsed.channelId,
        text: reply
      });
      await appendControlChannelHistory({
        channelId: parsed.channelId,
        direction: 'outbound',
        text: reply
      });
      return;
    }

    const nextStatus =
      command.command === 'approve'
        ? ApprovalRequestStatus.APPROVED
        : ApprovalRequestStatus.REJECTED;
    await prisma.approvalRequest.update({
      where: {
        id: approval.id
      },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
        decisionReason: `Resolved from Telegram command /${command.command}`
      }
    });

    const action = toRecord(approval.requestedAction);
    if (
      nextStatus === ApprovalRequestStatus.APPROVED &&
      typeof action.artifactId === 'string'
    ) {
      await sendAgentJob(AgentJobName.PublishArtifact, {
        organizationId: team.organizationId,
        teamId: team.id,
        artifactId: action.artifactId,
        runId: approval.runId ?? undefined,
        approvalRequestId: approval.id
      });
    }

    const reply = `${command.command === 'approve' ? 'Approved' : 'Rejected'} ${approval.title}.`;
    await notifyControlChannel({
      channelId: parsed.channelId,
      text: reply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: reply
    });
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
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: `The team ${team.name} does not have a ready runtime yet.`
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
      status: AgentRunStepStatus.RUNNING,
      kind: 'telegram-control',
      title: `Reply to Telegram for ${team.name}`,
      detail: `Processing inbound Telegram control message for ${team.name}.`,
      startedAt: new Date(),
      metadata: {
        channelId: parsed.channelId
      } as Prisma.InputJsonValue
    },
    select: {
      id: true
    }
  });

  try {
    await maybeSyncGatewaySessions(team.id, team.organizationId, runtime.id);

    const supervisorResult = await runComputerUseSupervisor({
      organizationId: team.organizationId,
      team: {
        id: team.id,
        name: team.name,
        desiredOutcome: team.desiredOutcome,
        promptPack: team.promptPack,
        teamSpec: team.teamSpec,
        supervisorConfig: team.supervisorConfig
      },
      runtime: {
        id: runtime.id,
        externalRuntimeId: runtime.externalRuntimeId,
        controlUrl: runtime.controlUrl,
        metadata: runtime.metadata,
        supervisorState: runtime.supervisorState
      },
      run: {
        id: run.id,
        objective: incomingText
      },
      reason: `telegram:${incomingText}`,
      operatorMessage: incomingText
    });
    const latestAssistantReply =
      supervisorResult.summary ?? 'Message delivered to the team.';

    await notifyControlChannel({
      channelId: parsed.channelId,
      text: latestAssistantReply
    });
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
      text: latestAssistantReply
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
          safetyCheckCount: supervisorResult.pendingSafetyChecks.length,
          actionCount: supervisorResult.actionCount
        } as Prisma.InputJsonValue
      }
    });

    await prisma.agentRun.update({
      where: {
        id: run.id
      },
      data: {
        status:
          supervisorResult.pendingSafetyChecks.length > 0
            ? AgentRunStatus.WAITING_APPROVAL
            : AgentRunStatus.SUCCEEDED,
        summary: latestAssistantReply,
        completedAt:
          supervisorResult.pendingSafetyChecks.length === 0 ? new Date() : null,
        waitingUntil:
          supervisorResult.pendingSafetyChecks.length > 0
            ? new Date(Date.now() + 1000 * 60 * 60 * 24)
            : null
      }
    });

    await createAgentAuditLog({
      organizationId: team.organizationId,
      teamId: team.id,
      runId: run.id,
      eventType: AgentAuditEventType.RUN_STATE_TRANSITION,
      summary: `Processed Telegram control message for ${team.name}.`,
      metadata: {
        channelId: parsed.channelId,
        safetyCheckCount: supervisorResult.pendingSafetyChecks.length
      }
    });

    await scheduleSupervisorTick({
      organizationId: team.organizationId,
      teamId: team.id,
      runtimeId: runtime.id,
      reason: 'telegram-followup',
      delayMs: 5_000
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
    await appendControlChannelHistory({
      channelId: parsed.channelId,
      direction: 'outbound',
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

  await boss.work(AgentJobName.SupervisorTick, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleSupervisorTickJob(job.data);
  });

  await boss.work(AgentJobName.HeartbeatRuntime, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleHeartbeatRuntimeJob(job.data);
  });

  await boss.work(AgentJobName.RecoverTeam, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleRecoverTeamJob(job.data);
  });

  await boss.work(AgentJobName.CleanupRuntime, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleCleanupRuntimeJob(job.data);
  });

  await boss.work(AgentJobName.PublishArtifact, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handlePublishArtifactJob(job.data);
  });

  await boss.work(AgentJobName.CheckPublishStatus, async ([job]) => {
    if (!job?.data) {
      return;
    }
    await handleCheckPublishStatusJob(job.data);
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
