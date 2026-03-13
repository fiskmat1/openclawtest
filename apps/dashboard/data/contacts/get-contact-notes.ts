import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { ValidationError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import { Caching, OrganizationCacheKey } from '~/data/caching';
import {
  getContactNotesSchema,
  type GetContactNotesSchema
} from '~/schemas/contacts/get-contact-notes-schema';
import type { ContactNoteDto } from '~/types/dtos/contact-note-dto';
import { SortDirection } from '~/types/sort-direction';

async function getContactNotesData(
  organizationId: string,
  contactId: string
): Promise<ContactNoteDto[]> {
  'use cache';
  cacheLife('default');
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.ContactNotes,
      organizationId,
      contactId
    )
  );
  cacheTag(
    Caching.createOrganizationTag(
      OrganizationCacheKey.Contact,
      organizationId,
      contactId
    )
  );
  cacheTag(
    Caching.createOrganizationTag(OrganizationCacheKey.Contacts, organizationId)
  );

  const notes = await prisma.contactNote.findMany({
    where: {
      contactId,
      contact: {
        organizationId
      }
    },
    select: {
      id: true,
      contactId: true,
      text: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    },
    orderBy: {
      createdAt: SortDirection.Asc
    }
  });

  return notes.map((note) => ({
    id: note.id,
    contactId: note.contactId,
    text: note.text ?? undefined,
    edited: note.createdAt.getTime() !== note.updatedAt.getTime(),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    sender: {
      id: note.user.id,
      name: note.user.name,
      image: note.user.image ?? undefined
    }
  }));
}

export async function getContactNotes(
  input: GetContactNotesSchema
): Promise<ContactNoteDto[]> {
  const ctx = await getAuthOrganizationContext();

  const result = getContactNotesSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(JSON.stringify(result.error.flatten()));
  }

  return getContactNotesData(ctx.organization.id, result.data.contactId);
}
