import { ALL_ADAPTERS } from './adapters';
import type { ToolAdapter } from './types';

const BY_NAME = new Map<string, ToolAdapter>(ALL_ADAPTERS.map((a) => [a.name, a]));

export function getAdapter(name: string): ToolAdapter | undefined {
  return BY_NAME.get(name);
}

export function listAdapters(): ToolAdapter[] {
  return ALL_ADAPTERS;
}

/** Public catalog (no functions) for the UI. */
export function toolCatalog() {
  return ALL_ADAPTERS.map((a) => ({
    name: a.name,
    category: a.category,
    targetKind: a.targetKind,
    active: a.active,
    description: a.description,
  }));
}
