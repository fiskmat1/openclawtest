'use client';

import NiceModal, { type NiceModalHocProps } from '@ebay/nice-modal-react';
import { type SubmitHandler } from 'react-hook-form';

import { agentTeamTemplateLabels } from '@workspace/agents/constants';
import { AgentTeamTemplate } from '@workspace/database';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@workspace/ui/components/dialog';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider
} from '@workspace/ui/components/form';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@workspace/ui/components/select';
import { toast } from '@workspace/ui/components/sonner';
import { Textarea } from '@workspace/ui/components/textarea';

import { createAgentTeam } from '~/actions/agents/create-agent-team';
import { useEnhancedModal } from '~/hooks/use-enhanced-modal';
import { useZodForm } from '~/hooks/use-zod-form';
import {
  createAgentTeamSchema,
  type CreateAgentTeamSchema
} from '~/schemas/agents/create-agent-team-schema';

export const CreateAgentTeamModal = NiceModal.create<NiceModalHocProps>(() => {
  const modal = useEnhancedModal();
  const methods = useZodForm({
    schema: createAgentTeamSchema,
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      template: AgentTeamTemplate.TIKTOK_MARKETING,
      description: '',
      desiredOutcome: '',
      cadenceCron: '0 */6 * * *'
    }
  });

  const canSubmit =
    !methods.formState.isSubmitting &&
    (!methods.formState.isSubmitted || methods.formState.isDirty);

  const onSubmit: SubmitHandler<CreateAgentTeamSchema> = async (values) => {
    if (!canSubmit) {
      return;
    }

    const result = await createAgentTeam(values);
    if (result?.data?.teamId && !result.serverError && !result.validationErrors) {
      toast.success('Agent team created');
      modal.handleClose();
    } else {
      toast.error(result?.serverError ?? "Couldn't create agent team");
    }
  };

  return (
    <FormProvider {...methods}>
      <Dialog open={modal.visible}>
        <DialogContent
          className="max-w-xl"
          onClose={modal.handleClose}
          onAnimationEndCapture={modal.handleAnimationEndCapture}
        >
          <DialogHeader>
            <DialogTitle>Create agent team</DialogTitle>
            <DialogDescription>
              Start with a production workflow template and let the worker create the seed agents for you.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={methods.handleSubmit(onSubmit)}
          >
            <FormField
              control={methods.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      required
                      disabled={methods.formState.isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={methods.control}
              name="template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Template</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={methods.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(AgentTeamTemplate).map((template) => (
                        <SelectItem
                          key={template}
                          value={template}
                        >
                          {agentTeamTemplateLabels[template]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={methods.control}
              name="desiredOutcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desired outcome</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={methods.formState.isSubmitting}
                      placeholder="Describe what this team should optimize for."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={methods.control}
                name="cadenceCron"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cadence cron</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="0 */6 * * *"
                        disabled={methods.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={methods.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Optional short description"
                        disabled={methods.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={modal.handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              loading={methods.formState.isSubmitting}
              onClick={methods.handleSubmit(onSubmit)}
            >
              Create team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
});
