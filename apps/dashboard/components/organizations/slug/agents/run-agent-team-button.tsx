'use client';

import * as React from 'react';

import { Button, type ButtonProps } from '@workspace/ui/components/button';
import { toast } from '@workspace/ui/components/sonner';

import { triggerAgentSupervision } from '~/actions/agents/trigger-agent-supervision';

export type RunAgentTeamButtonProps = ButtonProps & {
  teamId: string;
};

export function RunAgentTeamButton({
  teamId,
  ...props
}: RunAgentTeamButtonProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      {...props}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await triggerAgentSupervision({
            teamId,
            reason: 'manual supervision'
          });

          if (result?.data?.runId && !result.serverError && !result.validationErrors) {
            toast.success('Supervision run queued');
          } else {
            toast.error(result?.serverError ?? "Couldn't queue supervision run");
          }
        });
      }}
    >
      Run now
    </Button>
  );
}
