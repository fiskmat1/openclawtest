import { literal, z } from 'zod';

import { SortDirection } from '~/types/sort-direction';

const MAX_INT32 = +2147483647;

export enum GetContactsSortBy {
  Name = 'name',
  Email = 'email',
  Phone = 'phone',
  Stage = 'stage'
}

export enum RecordsOption {
  All = 'all',
  People = 'people',
  Companies = 'companies'
}

export const getContactsSchema = z.object({
  pageIndex: z.int()
    .min(0, 'Page number must be equal or greater than 1.')
    .max(MAX_INT32, `Page number must be equal or smaller than ${MAX_INT32}.`),
  pageSize: z.int()
    .min(1, 'Page size must be equal or greater than 1.')
    .max(100, 'Page number must be equal or smaller than 100.'),
  sortBy: z.enum(GetContactsSortBy, {
      error: (issue) => issue.input === undefined ? 'Sort by is required.' : 'Sort by must be a string.'
}),
  sortDirection: z.enum(SortDirection, {
      error: (issue) => issue.input === undefined ? 'Sort direction is required.' : 'Sort direction must be a string.'
}),
  searchQuery: z
    .string({
        error: (issue) => issue.input === undefined ? undefined : 'Search query must be a string.'
    })
    .max(2000, 'Maximum 2000 characters allowed.')
    .optional()
    .or(literal('')),
  records: z.enum(RecordsOption, {
      error: (issue) => issue.input === undefined ? 'Records is required.' : 'Records must be a string.'
}),
  tags: z.array(z.string().max(128, 'Maximum 128 characters allowed.'))
});

export type GetContactsSchema = z.infer<typeof getContactsSchema>;
