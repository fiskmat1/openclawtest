'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getPathname, replaceOrgSlug, routes, baseUrl } from '@workspace/routes';
import { buttonVariants } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import { useActiveOrganization } from '~/hooks/use-active-organization';

const items = [
  {
    title: 'Overview',
    href: routes.dashboard.organizations.slug.agents.Overview
  },
  {
    title: 'Teams',
    href: routes.dashboard.organizations.slug.agents.Teams
  },
  {
    title: 'Deployments',
    href: routes.dashboard.organizations.slug.agents.Deployments
  },
  {
    title: 'Runs',
    href: routes.dashboard.organizations.slug.agents.Runs
  },
  {
    title: 'Approvals',
    href: routes.dashboard.organizations.slug.agents.Approvals
  },
  {
    title: 'Integrations',
    href: routes.dashboard.organizations.slug.agents.Integrations
  }
] as const;

export function AgentsNav(): React.JSX.Element {
  const pathname = usePathname();
  const activeOrganization = useActiveOrganization();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const href = replaceOrgSlug(item.href, activeOrganization.slug);
        const isActive =
          pathname === getPathname(href, baseUrl.Dashboard) ||
          (item.href !== routes.dashboard.organizations.slug.agents.Index &&
            pathname.startsWith(getPathname(href, baseUrl.Dashboard)));

        return (
          <Link
            key={item.title}
            href={href}
            className={cn(
              buttonVariants({
                variant: isActive ? 'default' : 'ghost',
                size: 'sm'
              }),
              'h-8'
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
