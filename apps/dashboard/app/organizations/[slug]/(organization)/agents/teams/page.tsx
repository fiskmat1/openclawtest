import * as React from 'react';
import { type Metadata } from 'next';

import {
  agentRoleLabels,
  agentTeamStatusLabels,
  agentTeamTemplateLabels
} from '@workspace/agents/constants';
import {
  Alert,
  AlertDescription,
  AlertTitle
} from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@workspace/ui/components/table';

import { AgentStatusBadge } from '~/components/organizations/slug/agents/agent-status-badge';
import { AgentsPageShell } from '~/components/organizations/slug/agents/agents-page-shell';
import { CreateAgentTeamButton } from '~/components/organizations/slug/agents/create-agent-team-button';
import { DeployAgentTeamButton } from '~/components/organizations/slug/agents/deploy-agent-team-button';
import { RunAgentTeamButton } from '~/components/organizations/slug/agents/run-agent-team-button';
import { ToggleAgentTeamButton } from '~/components/organizations/slug/agents/toggle-agent-team-button';
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
      info="Describe an always-on mission, generate the specialist team blueprint, auto-deploy it onto E2B, and keep it supervised continuously."
      actions={<CreateAgentTeamButton size="sm" />}
    >
      <div className="space-y-6">
        <Alert variant="info">
          <AlertTitle>Spec-first autonomous teams</AlertTitle>
          <AlertDescription>
            Start from a mission and operating domains, then let the planner
            generate the OpenAI supervisor instructions and the OpenClaw
            specialist mesh automatically.
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
                        {team.mission ??
                          team.description ??
                          team.desiredOutcome ??
                          'No description yet.'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {team.autonomyLevel ?? 'guarded-autonomous'}
                        {team.operatingDomains.length > 0
                          ? ` • ${team.operatingDomains.join(', ')}`
                          : ''}
                        {team.telegramEnabled ? ' • telegram' : ''}
                        {team.browserEnabled ? ' • computer-use' : ''}
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
                      <ToggleAgentTeamButton
                        teamId={team.id}
                        status={team.status}
                        size="sm"
                        variant="outline"
                      />
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
              No teams yet. Describe the mission, connect OpenAI, E2B, and
              OpenClaw, then let the worker keep the team running continuously.
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
