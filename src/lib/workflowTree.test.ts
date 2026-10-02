import { describe, expect, it } from 'vitest';
import type { WorkNode } from './types';
import { canMoveInto, reorderedSiblingIds, workflowPath, workflowSiblings } from './workflowTree';

const node = (id: string, parent_id: string | null, sort_order: number): WorkNode => ({
  id,
  parent_id,
  sort_order,
  project_id: 'p',
  task_id: null,
  thread_id: null,
  kind: 'group',
  title: id,
  description: null,
  status: 'draft',
  priority: 'medium',
  primary_agent: null,
  workflow_model: null,
  workflow_reasoning: null,
  workflow_permission: 'workspace_write',
  workflow_limit_behavior: 'inherit',
  position_x: 0,
  position_y: 0,
  created_at: id,
  updated_at: id,
});

describe('workflow tree navigation and ordering', () => {
  const nodes = [
    node('root', null, 0),
    node('a', 'root', 2),
    node('b', 'root', 1),
    node('deep', 'a', 0),
  ];

  it('shows only direct children in saved order and builds a breadcrumb at any depth', () => {
    expect(workflowSiblings(nodes, 'root').map((n) => n.id)).toEqual(['b', 'a']);
    expect(workflowPath(nodes, 'deep').map((n) => n.id)).toEqual(['root', 'a', 'deep']);
    expect(workflowSiblings(nodes, 'deep')).toEqual([]);
  });

  it('prevents placing a node inside itself or a descendant', () => {
    expect(canMoveInto(nodes, 'root', 'deep')).toBe(false);
    expect(canMoveInto(nodes, 'a', 'a')).toBe(false);
    expect(canMoveInto(nodes, 'deep', 'b')).toBe(true);
  });

  it('stops traversing corrupt parent cycles', () => {
    const corrupt = [node('a', 'b', 0), node('b', 'a', 0)];
    expect(workflowPath(corrupt, 'a')).toHaveLength(2);
    expect(canMoveInto(corrupt, 'other', 'a')).toBe(false);
  });

  it('moves a sibling before or after and ignores invalid drops', () => {
    const siblings = workflowSiblings(nodes, 'root');
    expect(reorderedSiblingIds(siblings, 'a', 'b', false)).toEqual(['a', 'b']);
    expect(reorderedSiblingIds(siblings, 'b', 'a', true)).toEqual(['a', 'b']);
    expect(reorderedSiblingIds(siblings, 'deep', 'a', false)).toBeNull();
    expect(reorderedSiblingIds(siblings, 'a', 'a', false)).toBeNull();
  });
});
