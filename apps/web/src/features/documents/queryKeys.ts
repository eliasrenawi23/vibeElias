import type { DocumentOwner } from './types';

export const documentKeys = {
  all: ['documents'] as const,
  list: (owner: DocumentOwner) => [...documentKeys.all, 'list', owner] as const,
};
