import * as React from 'react';

import {
  Page,
  PageActions,
  PageBody,
  PageHeader,
  PagePrimaryBar,
  PageSecondaryBar
} from '@workspace/ui/components/page';
import { cn } from '@workspace/ui/lib/utils';

import { AgentsNav } from '~/components/organizations/slug/agents/agents-nav';
import { OrganizationPageTitle } from '~/components/organizations/slug/organization-page-title';

export type AgentsPageShellProps = {
  title: string;
  info?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
};

export function AgentsPageShell({
  title,
  info,
  actions,
  children,
  bodyClassName
}: AgentsPageShellProps): React.JSX.Element {
  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <OrganizationPageTitle
            title={title}
            info={info}
          />
          {actions ? <PageActions>{actions}</PageActions> : null}
        </PagePrimaryBar>
        <PageSecondaryBar>
          <AgentsNav />
        </PageSecondaryBar>
      </PageHeader>
      <PageBody className={cn('p-4 sm:p-6', bodyClassName)}>
        {children}
      </PageBody>
    </Page>
  );
}
