'use client';

import * as React from 'react';

import { Badge } from '@workspace/ui/components/badge';

function getBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status.toLowerCase();

  if (
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('rejected') ||
    normalized.includes('cancelled')
  ) {
    return 'destructive';
  }

  if (
    normalized.includes('ready') ||
    normalized.includes('active') ||
    normalized.includes('approved') ||
    normalized.includes('connected') ||
    normalized.includes('succeeded')
  ) {
    return 'default';
  }

  if (
    normalized.includes('pending') ||
    normalized.includes('queued') ||
    normalized.includes('provision') ||
    normalized.includes('waiting') ||
    normalized.includes('degraded') ||
    normalized.includes('connecting') ||
    normalized.includes('requires')
  ) {
    return 'secondary';
  }

  return 'outline';
}

export type AgentStatusBadgeProps = {
  status: string;
  label: string;
};

export function AgentStatusBadge({
  status,
  label
}: AgentStatusBadgeProps): React.JSX.Element {
  return <Badge variant={getBadgeVariant(status)}>{label}</Badge>;
}
