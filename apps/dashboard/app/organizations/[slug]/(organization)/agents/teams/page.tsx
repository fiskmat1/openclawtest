import * as React from 'react';
import { type Metadata } from 'next';

import {
  agentRoleLabels,
  agentTeamStatusLabels,
  agentTeamTemplateLabels
} from '@workspace/agents';
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@workspace/ui/components/table';

import { CreateAgentTeamButton } from '~/components/organizations/slug/agents/create-agent-team-button';
import { DeployAgentTeamButton } from '~/components/organizations/slug/agents/deploy-agent-team-button';
import { AgentsPageShell } from '~/components/organizations/slug/agents/agents-page-shell';
import { AgentStatusBadge } from '~/components/organizations/slug/agents/agent-status-badge';
import { RunAgentTeamButton } from '~/components/organizations/slug/agents/run-agent-team-button';
import { getAgentTeams } from '~/data/agents/get-agent-teams';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agent Teams')
};

export default async function AgentTeamsPage(): Promise<React.JSX.Element> {
  const teams = await getAgentTeams();

  return (
    <AgentsPageShell
      title="Agent teams"
      info="Seed specialized OpenClaw teams, deploy them, and trigger supervisor runs."
      actions={<CreateAgentTeamButton size="sm" />}
    >
      <div className="space-y-6">
        <Alert variant="info">
          <AlertTitle>TikTok marketing first</AlertTitle>
          <AlertDescription>
            The first production template is optimized for TikTok marketing, but the control plane is designed to expand into other supervised workflows.
          </AlertDescription>
        </Alert>

        {teams.length > 0 ? (
          <Table wrapperClassName="rounded-lg border">
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="align-top">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="max-w-md whitespace-normal text-sm text-muted-foreground">
                        {team.description ?? team.desiredOutcome ?? 'No description yet.'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {agentTeamTemplateLabels[team.template]}
                  </TableCell>
                  <TableCell>
                    <AgentStatusBadge
                      status={team.status}
                      label={agentTeamStatusLabels[team.status]}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-sm text-muted-foreground">
                    {team.primaryRoles.length > 0
                      ? team.primaryRoles
                          .map((role) => agentRoleLabels[role])
                          .join(', ')
                      : 'No agents yet'}
                  </TableCell>
                  <TableCell>{team.cadenceCron ?? 'Manual only'}</TableCell>
                  <TableCell>{team.pendingApprovalCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <RunAgentTeamButton
                        teamId={team.id}
                        size="sm"
                        variant="outline"
                      />
                      <DeployAgentTeamButton
                        teamId={team.id}
                        size="sm"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No teams yet. Start with the TikTok marketing template and connect the required providers afterwards.
            </p>
            <div className="mt-4">
              <CreateAgentTeamButton />
            </div>
          </div>
        )}
      </div>
    </AgentsPageShell>
  );
}
