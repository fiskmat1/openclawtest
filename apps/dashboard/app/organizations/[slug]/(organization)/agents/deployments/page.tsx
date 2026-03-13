import * as React from 'react';
import Link from 'next/link';
import { type Metadata } from 'next';

import {
  agentDeploymentStatusLabels,
  agentRuntimeProviderLabels
} from '@workspace/agents';
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert';
import { buttonVariants } from '@workspace/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@workspace/ui/components/table';

import { AgentsPageShell } from '~/components/organizations/slug/agents/agents-page-shell';
import { AgentStatusBadge } from '~/components/organizations/slug/agents/agent-status-badge';
import { getAgentDeployments } from '~/data/agents/get-agent-deployments';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agent Deployments')
};

export default async function AgentDeploymentsPage(): Promise<React.JSX.Element> {
  const deployments = await getAgentDeployments();

  return (
    <AgentsPageShell
      title="Deployments"
      info="Provisioned runtimes, manual control URLs, and lifecycle status."
    >
      <div className="space-y-6">
        <Alert variant="warning">
          <AlertTitle>Lifecycle automation guardrail</AlertTitle>
          <AlertDescription>
            Runtime creation is automated, but control URLs are still surfaced so operators can manually inspect or recover a provider deployment when needed.
          </AlertDescription>
        </Alert>

        {deployments.length > 0 ? (
          <Table wrapperClassName="rounded-lg border">
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Failure</TableHead>
                <TableHead className="text-right">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>{deployment.teamName}</TableCell>
                  <TableCell>
                    {agentRuntimeProviderLabels[deployment.provider]}
                  </TableCell>
                  <TableCell>
                    <AgentStatusBadge
                      status={deployment.status}
                      label={agentDeploymentStatusLabels[deployment.status]}
                    />
                  </TableCell>
                  <TableCell>{deployment.runtimeName ?? 'Pending runtime'}</TableCell>
                  <TableCell>{deployment.region ?? 'n/a'}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-sm text-muted-foreground">
                    {deployment.failureReason ?? 'No failure recorded'}
                  </TableCell>
                  <TableCell className="text-right">
                    {deployment.controlUrl ? (
                      <Link
                        href={deployment.controlUrl}
                        target="_blank"
                        className={buttonVariants({ size: 'sm', variant: 'outline' })}
                      >
                        Open
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unavailable</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No deployments yet. Deploy a team from the Teams tab after configuring a Kilo connection.
          </p>
        )}
      </div>
    </AgentsPageShell>
  );
}
