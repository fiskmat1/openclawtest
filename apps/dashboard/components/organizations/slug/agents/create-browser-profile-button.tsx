'use client';

import * as React from 'react';
import NiceModal from '@ebay/nice-modal-react';

import { Button, type ButtonProps } from '@workspace/ui/components/button';

import { CreateBrowserProfileModal } from '~/components/organizations/slug/agents/create-browser-profile-modal';

export type CreateBrowserProfileButtonProps = ButtonProps & {
  kernelConnections: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
};

export function CreateBrowserProfileButton({
  kernelConnections,
  teams,
  ...props
}: CreateBrowserProfileButtonProps): React.JSX.Element {
  return (
    <Button
      {...props}
      onClick={() => {
        void NiceModal.show(CreateBrowserProfileModal, {
          kernelConnections,
          teams
        });
      }}
    >
      Create browser profile
    </Button>
  );
}
