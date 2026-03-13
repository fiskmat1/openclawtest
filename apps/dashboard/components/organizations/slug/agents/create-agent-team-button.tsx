'use client';

import * as React from 'react';
import NiceModal from '@ebay/nice-modal-react';

import { Button, type ButtonProps } from '@workspace/ui/components/button';

import { CreateAgentTeamModal } from '~/components/organizations/slug/agents/create-agent-team-modal';

export function CreateAgentTeamButton(
  props: ButtonProps
): React.JSX.Element {
  return (
    <Button
      {...props}
      onClick={() => {
        void NiceModal.show(CreateAgentTeamModal);
      }}
    >
      Create team
    </Button>
  );
}
