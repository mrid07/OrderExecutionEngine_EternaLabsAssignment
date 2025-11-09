import { describe, it, expect } from 'vitest';
import { pushStatus, getStatuses, clearStatuses } from '../../ws/state.js';

describe('ws/state replay buffer', () => {
  it('stores and returns last messages', () => {
    const id = 'test-order-123';
    clearStatuses(id);
    pushStatus(id, { status: 'routing' });
    pushStatus(id, { status: 'building' });
    const arr = getStatuses(id);
    expect(arr.length).toBe(2);
    expect(arr[0].status).toBe('routing');
    expect(arr[1].status).toBe('building');
    clearStatuses(id);
    expect(getStatuses(id).length).toBe(0);
  });
});
