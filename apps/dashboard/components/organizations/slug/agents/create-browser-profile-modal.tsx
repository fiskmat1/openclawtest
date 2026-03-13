'use client';

import NiceModal, { type NiceModalHocProps } from '@ebay/nice-modal-react';
import { type SubmitHandler } from 'react-hook-form';

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
import { Switch } from '@workspace/ui/components/switch';

import { createBrowserProfile } from '~/actions/agents/create-browser-profile';
import { useEnhancedModal } from '~/hooks/use-enhanced-modal';
import { useZodForm } from '~/hooks/use-zod-form';
import {
  createBrowserProfileSchema,
  type CreateBrowserProfileSchema
} from '~/schemas/agents/create-browser-profile-schema';

export type CreateBrowserProfileModalProps = NiceModalHocProps & {
  kernelConnections: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
};

export const CreateBrowserProfileModal =
  NiceModal.create<CreateBrowserProfileModalProps>(
    ({ kernelConnections, teams }) => {
      const modal = useEnhancedModal();
      const methods = useZodForm({
        schema: createBrowserProfileSchema,
        mode: 'onSubmit',
        defaultValues: {
          providerConnectionId: kernelConnections[0]?.id ?? '',
          teamId: teams[0]?.id ?? undefined,
          name: '',
          managedAuth: false,
          saveChanges: true
        }
      });

      const canSubmit =
        !methods.formState.isSubmitting &&
        (!methods.formState.isSubmitted || methods.formState.isDirty);

      const onSubmit: SubmitHandler<CreateBrowserProfileSchema> = async (
        values
      ) => {
        if (!canSubmit) {
          return;
        }

        const result = await createBrowserProfile(values);
        if (
          result?.data?.browserProfileId &&
          !result.serverError &&
          !result.validationErrors
        ) {
          toast.success('Browser profile created');
          modal.handleClose();
        } else {
          toast.error(result?.serverError ?? "Couldn't create browser profile");
        }
      };

      return (
        <FormProvider {...methods}>
          <Dialog open={modal.visible}>
            <DialogContent
              className="max-w-lg"
              onClose={modal.handleClose}
              onAnimationEndCapture={modal.handleAnimationEndCapture}
            >
              <DialogHeader>
                <DialogTitle>Create browser profile</DialogTitle>
                <DialogDescription>
                  Provision a persistent browser profile for last-mile automations and authenticated workflows.
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
                  name="providerConnectionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Kernel integration</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={methods.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a Kernel connection" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {kernelConnections.map((connection) => (
                            <SelectItem
                              key={connection.id}
                              value={connection.id}
                            >
                              {connection.name}
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
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value || undefined)}
                        disabled={methods.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Attach to a team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem
                              key={team.id}
                              value={team.id}
                            >
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={methods.control}
                    name="managedAuth"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <FormLabel className="mb-0">Managed auth</FormLabel>
                        <FormControl>
                          <Switch
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
                    name="saveChanges"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <FormLabel className="mb-0">Persist session state</FormLabel>
                        <FormControl>
                          <Switch
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
                  Create profile
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </FormProvider>
      );
    }
  );
