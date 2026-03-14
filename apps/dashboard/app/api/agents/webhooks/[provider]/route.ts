import { NextResponse, type NextRequest } from 'next/server';

import { sendAgentJob } from '@workspace/agents/boss';
import { keys as agentKeys } from '@workspace/agents/keys';
import { AgentJobName } from '@workspace/agents/queue';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { provider } = await context.params;
  const webhookSecret = agentKeys().AGENTS_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get('x-agents-webhook-secret');

  if (webhookSecret && suppliedSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const searchOrganizationId =
    request.nextUrl.searchParams.get('organizationId');
  const searchTeamId = request.nextUrl.searchParams.get('teamId');
  const searchRuntimeId = request.nextUrl.searchParams.get('runtimeId');
  const searchDeploymentId = request.nextUrl.searchParams.get('deploymentId');
  const payload = isRecord(body) ? body : {};
  const organizationId =
    searchOrganizationId ??
    (typeof payload.organizationId === 'string'
      ? payload.organizationId
      : undefined);
  const teamId =
    searchTeamId ??
    (typeof payload.teamId === 'string' ? payload.teamId : undefined);
  const runtimeId =
    searchRuntimeId ??
    (typeof payload.runtimeId === 'string' ? payload.runtimeId : undefined);
  const deploymentId =
    searchDeploymentId ??
    (typeof payload.deploymentId === 'string'
      ? payload.deploymentId
      : undefined);

  await sendAgentJob(AgentJobName.ProcessProviderWebhook, {
    provider,
    organizationId,
    teamId,
    runtimeId,
    deploymentId,
    payload
  });

  return NextResponse.json(
    {
      accepted: true
    },
    {
      status: 202
    }
  );
}
