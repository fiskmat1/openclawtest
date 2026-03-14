'use client';

import NiceModal, { type NiceModalHocProps } from '@ebay/nice-modal-react';
import { type SubmitHandler } from 'react-hook-form';

import { agentTeamTemplateLabels } from '@workspace/agents/constants';
import { AgentTeamTemplate } from '@workspace/database';
import { Button } from '@workspace/ui/components/button';
import { Checkbox } from '@workspace/ui/components/checkbox';
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
      template: AgentTeamTemplate.GENERIC_OPERATIONS,
      description: '',
      mission: '',
      desiredOutcome: '',
      operatingDomainsText: '',
      agentRoleHintsText: '',
      autonomyLevel: 'guarded-autonomous',
      cadenceCron: '0 */4 * * *',
      telegramEnabled: true,
      browserEnabled: true,
      accountTargetsText: '',
      allowedDomainsText: '',
      operatorInstructions: ''
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
            <DialogTitle>Create autonomous team</DialogTitle>
            <DialogDescription>
              Describe the operating mission, then let the planner generate the
              OpenClaw specialists and OpenAI supervisor blueprint for you.
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
                        placeholder="Customer support swarm"
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
              name="mission"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Mission</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={methods.formState.isSubmitting}
                      placeholder="Run the operation continuously, manage specialist agents, and keep progressing toward a concrete business outcome."
                      {...field}
                    />
                  </FormControl>
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
                      placeholder="Describe the exact business result this team should optimize for."
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
                name="autonomyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Autonomy level</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={methods.formState.isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select autonomy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="supervised">Supervised</SelectItem>
                        <SelectItem value="guarded-autonomous">
                          Guarded autonomous
                        </SelectItem>
                        <SelectItem value="autonomous">Autonomous</SelectItem>
                      </SelectContent>
                    </Select>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={methods.control}
                name="operatingDomainsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operating domains</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={methods.formState.isSubmitting}
                        placeholder="telegram support&#10;lead qualification&#10;crm follow-up"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={methods.control}
                name="agentRoleHintsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requested agent roles</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={methods.formState.isSubmitting}
                        placeholder="support supervisor&#10;conversation researcher&#10;reply drafter&#10;quality reviewer"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={methods.control}
                name="accountTargetsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounts and channels</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={methods.formState.isSubmitting}
                        placeholder="Telegram bot inbox&#10;OpenClaw dashboard&#10;HubSpot workspace"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={methods.control}
                name="allowedDomainsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed domains</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={methods.formState.isSubmitting}
                        placeholder="web.telegram.org&#10;app.hubspot.com&#10;openclaw.example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={methods.control}
              name="operatorInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={methods.formState.isSubmitting}
                      placeholder="Optional guardrails, escalation notes, or house rules for the always-on supervisor."
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
                name="telegramEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Telegram control</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Allow operators to bind chats and steer the supervisor.
                      </p>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={methods.formState.isSubmitting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={methods.control}
                name="browserEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Computer use</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Let the supervisor use the E2B desktop for last-mile
                        browser work.
                      </p>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={methods.formState.isSubmitting}
                      />
                    </FormControl>
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
