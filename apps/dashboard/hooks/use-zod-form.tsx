import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type UseFormProps,
  type UseFormReturn
} from 'react-hook-form';
import type { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useZodForm<TSchema extends z.ZodType<any, any>>(
  props: Omit<UseFormProps<z.input<TSchema>>, 'resolver'> & {
    schema: TSchema;
  }
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  return useForm({
    ...props,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(props.schema as any, undefined, {
      // This makes it so we can use `.transform()`s on the schema without same transform getting applied again when it reaches the server
      raw: true
    })
  }) as UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>>;
}
