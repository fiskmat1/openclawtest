'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { toast } from '@workspace/ui/components/sonner';

import { resolveApprovalRequest } from '~/actions/agents/resolve-approval-request';

export type ResolveApprovalButtonsProps = {
  approvalRequestId: string;
  disabled?: boolean;
};

export function ResolveApprovalButtons({
  approvalRequestId,
  disabled
}: ResolveApprovalButtonsProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  const handleResolve = (approved: boolean) => {
    startTransition(async () => {
      const result = await resolveApprovalRequest({
        id: approvalRequestId,
        approved
      });

      if (!result?.serverError && !result?.validationErrors) {
        toast.success(approved ? 'Approval granted' : 'Approval rejected');
      } else {
        toast.error(result?.serverError ?? "Couldn't resolve approval");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isPending}
        onClick={() => handleResolve(false)}
      >
        Reject
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={disabled || isPending}
        loading={isPending}
        onClick={() => handleResolve(true)}
      >
        Approve
      </Button>
    </div>
  );
}
