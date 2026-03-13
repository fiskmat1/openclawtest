'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { toast } from '@workspace/ui/components/sonner';

import { updateAgentArtifactUrl } from '~/actions/agents/update-agent-artifact-url';

export type ArtifactUrlFormProps = {
  artifactId: string;
  defaultValue?: string;
};

export function ArtifactUrlForm({
  artifactId,
  defaultValue
}: ArtifactUrlFormProps): React.JSX.Element {
  const [url, setUrl] = React.useState(defaultValue ?? '');
  const [isPending, startTransition] = React.useTransition();

  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <Input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://example.com/video.mp4"
        disabled={isPending}
      />
      <Button
        type="button"
        size="sm"
        disabled={!url || isPending}
        loading={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateAgentArtifactUrl({
              artifactId,
              url
            });

            if (
              result?.data?.artifactId &&
              !result.serverError &&
              !result.validationErrors
            ) {
              toast.success('Artifact URL saved');
            } else {
              toast.error(result?.serverError ?? "Couldn't save artifact URL");
            }
          });
        }}
      >
        Save
      </Button>
    </div>
  );
}
