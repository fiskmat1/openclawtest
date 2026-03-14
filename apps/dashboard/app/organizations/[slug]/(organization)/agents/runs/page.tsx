import * as React from 'react';
import { type Metadata } from 'next';

import { agentRunStatusLabels } from '@workspace/agents/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@workspace/ui/components/table';

import { ArtifactUrlForm } from '~/components/organizations/slug/agents/artifact-url-form';
import { AgentsPageShell } from '~/components/organizations/slug/agents/agents-page-shell';
import { AgentStatusBadge } from '~/components/organizations/slug/agents/agent-status-badge';
import { getAgentArtifacts } from '~/data/agents/get-agent-artifacts';
import { getAgentRuns } from '~/data/agents/get-agent-runs';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agent Runs')
};

export default async function AgentRunsPage(): Promise<React.JSX.Element> {
  const [runs, artifacts] = await Promise.all([getAgentRuns(), getAgentArtifacts()]);

  return (
    <AgentsPageShell
      title="Runs"
      info="Execution history, draft artifacts, and publish-readiness handoff."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {runs.length > 0 ? (
              <Table wrapperClassName="rounded-b-lg border-t">
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Artifacts</TableHead>
                    <TableHead>Approvals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="align-top">
                        <div>
                          <p className="font-medium">{run.title ?? 'Untitled run'}</p>
                          <p className="max-w-md whitespace-normal text-sm text-muted-foreground">
                            {run.summary ?? run.objective ?? 'No summary yet.'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{run.teamName}</TableCell>
                      <TableCell>
                        <AgentStatusBadge
                          status={run.status}
                          label={agentRunStatusLabels[run.status]}
                        />
                      </TableCell>
                      <TableCell>{run.trigger.toLowerCase()}</TableCell>
                      <TableCell>{run.artifactTypes.join(', ') || 'None'}</TableCell>
                      <TableCell>{run.approvalCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No runs yet. Trigger a supervision run from the Teams tab after deployment.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest artifacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {artifacts.length > 0 ? (
              artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{artifact.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {artifact.type.toLowerCase()}
                      </p>
                    </div>
                    {artifact.type === 'VIDEO' ? (
                      <ArtifactUrlForm
                        artifactId={artifact.id}
                        defaultValue={artifact.url}
                      />
                    ) : null}
                  </div>

                  {artifact.textContent ? (
                    <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                      {artifact.textContent}
                    </pre>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Artifacts will appear here after the supervisor creates drafts or publish-ready assets.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentsPageShell>
  );
}
