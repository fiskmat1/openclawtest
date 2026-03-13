import * as React from 'react';
import { type Metadata } from 'next';

import {
  approvalRequestStatusLabels,
  approvalRiskLevelLabels
} from '@workspace/agents';
import { ApprovalRequestStatus } from '@workspace/database';
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
import { ResolveApprovalButtons } from '~/components/organizations/slug/agents/resolve-approval-buttons';
import { getApprovalRequests } from '~/data/agents/get-approval-requests';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Agent Approvals')
};

export default async function AgentApprovalsPage(): Promise<React.JSX.Element> {
  const approvals = await getApprovalRequests();

  return (
    <AgentsPageShell
      title="Approvals"
      info="Review high-risk actions before content is published or credentials are changed."
    >
      {approvals.length > 0 ? (
        <Table wrapperClassName="rounded-lg border">
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action payload</TableHead>
              <TableHead className="text-right">Resolve</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.map((approval) => (
              <TableRow key={approval.id}>
                <TableCell className="align-top">
                  <div>
                    <p className="font-medium">{approval.title}</p>
                    <p className="max-w-md whitespace-normal text-sm text-muted-foreground">
                      {approval.description ?? 'No description provided.'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{approval.teamName}</TableCell>
                <TableCell>
                  <AgentStatusBadge
                    status={approval.riskLevel}
                    label={approvalRiskLevelLabels[approval.riskLevel]}
                  />
                </TableCell>
                <TableCell>
                  <AgentStatusBadge
                    status={approval.status}
                    label={approvalRequestStatusLabels[approval.status]}
                  />
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                  {approval.requestedAction
                    ? JSON.stringify(approval.requestedAction, null, 2)
                    : 'No payload'}
                </TableCell>
                <TableCell className="text-right">
                  {approval.status === ApprovalRequestStatus.PENDING ? (
                    <ResolveApprovalButtons approvalRequestId={approval.id} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {approval.decisionReason ?? 'Resolved'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">
          No approvals are waiting. Pending publish, credential, and spend checks will surface here.
        </p>
      )}
    </AgentsPageShell>
  );
}
