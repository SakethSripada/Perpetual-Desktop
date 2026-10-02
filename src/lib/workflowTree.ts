import type { WorkNode } from './types';

export function workflowSiblings(nodes: WorkNode[], parent: string | null): WorkNode[] {
  return nodes
    .filter((node) => node.parent_id === parent)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function workflowPath(nodes: WorkNode[], current: string | null): WorkNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: WorkNode[] = [];
  const seen = new Set<string>();
  let id = current;
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = byId.get(id);
    if (!node) break;
    path.unshift(node);
    id = node.parent_id;
  }
  return path;
}

export function canMoveInto(nodes: WorkNode[], nodeId: string, candidateId: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let id: string | null = candidateId;
  while (id) {
    if (id === nodeId || seen.has(id)) return false;
    seen.add(id);
    id = byId.get(id)?.parent_id ?? null;
  }
  return true;
}

export function reorderedSiblingIds(
  siblings: WorkNode[],
  sourceId: string,
  targetId: string,
  after: boolean,
): string[] | null {
  if (sourceId === targetId || !siblings.some((node) => node.id === sourceId)) return null;
  const ids = siblings.map((node) => node.id).filter((id) => id !== sourceId);
  const index = ids.indexOf(targetId);
  if (index < 0) return null;
  ids.splice(index + Number(after), 0, sourceId);
  return ids;
}
