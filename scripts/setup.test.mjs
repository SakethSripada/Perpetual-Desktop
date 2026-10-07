import { describe, expect, it } from 'vitest';
import { supportedNode } from './setup.mjs';

describe('source setup runtime compatibility', () => {
  it.each(['v22.13.0', '22.22.0', '24.0.0', '26.0.0', '28.1.0'])('accepts %s', (version) => {
    expect(supportedNode(version)).toBe(true);
  });
  it.each(['20.19.0', '22.12.0', '23.10.0', '25.0.0', 'invalid'])('rejects %s', (version) => {
    expect(supportedNode(version)).toBe(false);
  });
});
