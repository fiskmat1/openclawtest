import * as React from 'react';
import { type Metadata } from 'next';

import {
  agentRunStatusLabels,
  agentTeamStatusLabels,
  providerConnectionStatusLabels
} from '@workspace/agents';
import {
  Alert,
  AlertDescription,
  AlertTitle
} from '@workspace/ui/components/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';

import { AgentStatusBadge } from '~/components/organizations/slug/agents/agent-status-badge';
import { AgentsPageShell } from '~/components/organizations/slug/agents/agents-page-shell';
import { CreateAgentTeamButton } from '~/components/organizations/slug/agents/create-agent-team-button';
import { getAgentOverview } from '~/data/agents/get-agent-overview';
import { getAgentTeams } from '~/data/agents/get-agent-teams';
import { getApprovalRequests } from '~/data/agents/get-approval-requests';
import { getProviderConnections } from '~/data/agents/get-provider-connections';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agents')
};

export default async function AgentsOverviewPage(): Promise<React.JSX.Element> {
  const [overview, teams, approvals, connections] = await Promise.all([
    getAgentOverview(),
    getAgentTeams(),
    getApprovalRequests(),
    getProviderConnections()
  ]);

  return (
    <AgentsPageShell
      title="Agents"
      info="E2B-powered OpenClaw operations, Telegram control channels, approvals, and live computer use."
      actions={<CreateAgentTeamButton size="sm" />}
    >
      <div className="space-y-6">
        <Alert variant="info">
          <AlertTitle>API-first automation</AlertTitle>
          <AlertDescription>
            Deployments, supervision, Telegram routing, and publishing prefer
            provider APIs and durable jobs first, with desktop automation
            reserved for the unsupported last mile.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Teams</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.teamCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active teams</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.activeTeamCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ready runtimes</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.runtimeReadyCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.pendingApprovalCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected integrations</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.connectedIntegrationCount}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Recent teams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {teams.length > 0 ? (
                teams.slice(0, 4).map((team) => (
                  <div
                    key={team.id}
                    className="flex flex-col gap-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {team.description ??
                            team.desiredOutcome ??
                            'No description yet.'}
                        </p>
                      </div>
                      <AgentStatusBadge
                        status={team.status}
                        label={agentTeamStatusLabels[team.status]}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{team.agentCount} agents</span>
                      <span>{team.runtimeCount} runtimes</span>
                      <span>{team.pendingApprovalCount} pending approvals</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No agent teams yet. Create one to start provisioning E2B
                  desktops and OpenClaw sessions automatically.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.latestRun ? (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">Latest run</p>
                  <p className="text-sm text-muted-foreground">
                    {overview.latestRun.teamName}: {overview.latestRun.title}
                  </p>
                  <AgentStatusBadge
                    status={overview.latestRun.status}
                    label={
                      agentRunStatusLabels[
                        overview.latestRun
                          .status as keyof typeof agentRunStatusLabels
                      ] ?? overview.latestRun.status
                    }
                  />
                </div>
              ) : null}

              {approvals[0] ? (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">Top approval</p>
                  <p className="text-sm text-muted-foreground">
                    {approvals[0].teamName}: {approvals[0].title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Risk: {approvals[0].riskLevel.toLowerCase()}
                  </p>
                </div>
              ) : null}

              {connections[0] ? (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">Latest integration</p>
                  <p className="text-sm text-muted-foreground">
                    {connections[0].name}
                  </p>
                  <AgentStatusBadge
                    status={connections[0].status}
                    label={
                      providerConnectionStatusLabels[connections[0].status]
                    }
                  />
                </div>
              ) : null}

              {!overview.latestRun && !approvals[0] && !connections[0] ? (
                <p className="text-sm text-muted-foreground">
                  Deploy a team and connect integrations to start receiving
                  execution signals here.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentsPageShell>
  );
}
