'use client';

import * as React from 'react';

import { AgentRuntimeProvider } from '@workspace/database';
import { Button, type ButtonProps } from '@workspace/ui/components/button';
import { toast } from '@workspace/ui/components/sonner';

import { requestAgentDeployment } from '~/actions/agents/request-agent-deployment';

export type DeployAgentTeamButtonProps = ButtonProps & {
  teamId: string;
};

export function DeployAgentTeamButton({
  teamId,
  ...props
}: DeployAgentTeamButtonProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      {...props}
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await requestAgentDeployment({
            teamId,
            provider: AgentRuntimeProvider.E2B
          });

          if (
            result?.data?.deploymentId &&
            !result.serverError &&
            !result.validationErrors
          ) {
            toast.success('Deployment requested');
          } else {
            toast.error(result?.serverError ?? "Couldn't request deployment");
          }
        });
      }}
    >
      Deploy
    </Button>
  );
}
