'use client';

import NiceModal, { type NiceModalHocProps } from '@ebay/nice-modal-react';
import { type SubmitHandler } from 'react-hook-form';

import { providerConnectionTypeLabels } from '@workspace/agents/constants';
import { ProviderConnectionType } from '@workspace/database';
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

import { createProviderConnection } from '~/actions/agents/create-provider-connection';
import { useEnhancedModal } from '~/hooks/use-enhanced-modal';
import { useZodForm } from '~/hooks/use-zod-form';
import {
  createProviderConnectionSchema,
  type CreateProviderConnectionSchema
} from '~/schemas/agents/create-provider-connection-schema';

export const CreateProviderConnectionModal =
  NiceModal.create<NiceModalHocProps>(() => {
    const modal = useEnhancedModal();
    const methods = useZodForm({
      schema: createProviderConnectionSchema,
      mode: 'onSubmit',
      defaultValues: {
        type: ProviderConnectionType.E2B,
        name: '',
        accessToken: '',
        refreshToken: '',
        secret: '',
        externalAccountId: '',
        externalWorkspaceId: '',
        metadataJson: ''
      }
    });

    const canSubmit =
      !methods.formState.isSubmitting &&
      (!methods.formState.isSubmitted || methods.formState.isDirty);

    const onSubmit: SubmitHandler<CreateProviderConnectionSchema> = async (
      values
    ) => {
      if (!canSubmit) {
        return;
      }

      const result = await createProviderConnection(values);
      if (
        result?.data?.connectionId &&
        !result.serverError &&
        !result.validationErrors
      ) {
        toast.success('Integration saved');
        modal.handleClose();
      } else {
        toast.error(result?.serverError ?? "Couldn't save integration");
      }
    };

    return (
      <FormProvider {...methods}>
        <Dialog open={modal.visible}>
          <DialogContent
            className="max-w-2xl"
            onClose={modal.handleClose}
            onAnimationEndCapture={modal.handleAnimationEndCapture}
          >
            <DialogHeader>
              <DialogTitle>Add integration</DialogTitle>
              <DialogDescription>
                Save provider credentials securely so E2B deployments, OpenClaw
                sessions, Telegram control channels, and publishing can be
                automated.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={methods.handleSubmit(onSubmit)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={methods.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Provider</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={methods.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ProviderConnectionType).map((type) => (
                            <SelectItem
                              key={type}
                              value={type}
                            >
                              {providerConnectionTypeLabels[type]}
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={methods.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
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
                  name="refreshToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refresh token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
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
                  name="secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
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
                  name="externalWorkspaceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External workspace ID</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          disabled={methods.formState.isSubmitting}
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
                name="externalAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External account ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
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
                name="metadataJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metadata JSON</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={methods.formState.isSubmitting}
                        placeholder='{"preferredRegion":"eu-central","template":"desktop","rpcEndpoint":"https://openclaw.example.com/rpc","webhookBaseUrl":"https://dashboard.example.com"}'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                Save integration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FormProvider>
    );
  });
