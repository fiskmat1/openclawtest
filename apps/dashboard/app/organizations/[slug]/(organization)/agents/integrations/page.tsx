import * as React from 'react';
import { type Metadata } from 'next';

import {
  browserProfileStatusLabels,
  providerConnectionStatusLabels,
  providerConnectionTypeLabels
} from '@workspace/agents';
import { ProviderConnectionType } from '@workspace/database';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
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
import { CreateBrowserProfileButton } from '~/components/organizations/slug/agents/create-browser-profile-button';
import { CreateProviderConnectionButton } from '~/components/organizations/slug/agents/create-provider-connection-button';
import { getBrowserProfiles } from '~/data/agents/get-browser-profiles';
import { getProviderConnections } from '~/data/agents/get-provider-connections';
import { getAgentTeams } from '~/data/agents/get-agent-teams';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agent Integrations')
};

export default async function AgentIntegrationsPage(): Promise<React.JSX.Element> {
  const [connections, browserProfiles, teams] = await Promise.all([
    getProviderConnections(),
    getBrowserProfiles(),
    getAgentTeams()
  ]);

  const kernelConnections = connections
    .filter((connection) => connection.type === ProviderConnectionType.KERNEL)
    .map((connection) => ({
      id: connection.id,
      name: connection.name
    }));

  return (
    <AgentsPageShell
      title="Integrations"
      info="Connect managed runtimes, browser sessions, and social publishing providers."
      actions={
        <>
          {kernelConnections.length > 0 ? (
            <CreateBrowserProfileButton
              size="sm"
              variant="outline"
              kernelConnections={kernelConnections}
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            />
          ) : null}
          <CreateProviderConnectionButton size="sm" />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider connections</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {connections.length > 0 ? (
              <Table wrapperClassName="rounded-b-lg border-t">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>{connection.name}</TableCell>
                      <TableCell>
                        {providerConnectionTypeLabels[connection.type]}
                      </TableCell>
                      <TableCell>
                        <AgentStatusBadge
                          status={connection.status}
                          label={providerConnectionStatusLabels[connection.status]}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[
                          connection.hasAccessToken ? 'access' : null,
                          connection.hasRefreshToken ? 'refresh' : null,
                          connection.hasSecret ? 'secret' : null
                        ]
                          .filter(Boolean)
                          .join(', ') || 'No credentials yet'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No integrations connected yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Browser profiles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {browserProfiles.length > 0 ? (
              <Table wrapperClassName="rounded-b-lg border-t">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Session mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {browserProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>{profile.name}</TableCell>
                      <TableCell>{profile.teamName ?? 'Shared'}</TableCell>
                      <TableCell>
                        <AgentStatusBadge
                          status={profile.status}
                          label={browserProfileStatusLabels[profile.status]}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.managedAuth ? 'Managed auth' : 'Manual auth'} /{' '}
                        {profile.saveChanges ? 'persistent' : 'ephemeral'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No browser profiles yet. Add a Kernel connection first, then create a persistent profile.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentsPageShell>
  );
}
