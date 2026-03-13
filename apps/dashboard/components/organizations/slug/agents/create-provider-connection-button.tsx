'use client';

import * as React from 'react';
import NiceModal from '@ebay/nice-modal-react';

import { Button, type ButtonProps } from '@workspace/ui/components/button';

import { CreateProviderConnectionModal } from '~/components/organizations/slug/agents/create-provider-connection-modal';

export function CreateProviderConnectionButton(
  props: ButtonProps
): React.JSX.Element {
  return (
    <Button
      {...props}
      onClick={() => {
        void NiceModal.show(CreateProviderConnectionModal);
      }}
    >
      Add integration
    </Button>
  );
}
