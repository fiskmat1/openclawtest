'use client';

import * as React from 'react';

import { AgentTeamStatus } from '@workspace/database';
import { Button, type ButtonProps } from '@workspace/ui/components/button';
import { toast } from '@workspace/ui/components/sonner';

import { setAgentTeamStatus } from '~/actions/agents/set-agent-team-status';

export type ToggleAgentTeamButtonProps = ButtonProps & {
  teamId: string;
  status: AgentTeamStatus;
};

export function ToggleAgentTeamButton({
  teamId,
  status,
  ...props
}: ToggleAgentTeamButtonProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();
  const nextStatus =
    status === AgentTeamStatus.PAUSED
      ? AgentTeamStatus.ACTIVE
      : AgentTeamStatus.PAUSED;

  return (
    <Button
      {...props}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await setAgentTeamStatus({
            teamId,
            status: nextStatus
          });

          if (result?.data?.teamId && !result.serverError && !result.validationErrors) {
            toast.success(
              nextStatus === AgentTeamStatus.ACTIVE
                ? 'Team resumed'
                : 'Team paused'
            );
          } else {
            toast.error(
              result?.serverError ??
                `Couldn't ${nextStatus === AgentTeamStatus.ACTIVE ? 'resume' : 'pause'} team`
            );
          }
        });
      }}
    >
      {nextStatus === AgentTeamStatus.ACTIVE ? 'Resume' : 'Pause'}
    </Button>
  );
}
