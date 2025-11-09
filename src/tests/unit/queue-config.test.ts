import { describe, it, expect } from 'vitest';
import { defaultJobOpts } from '../../queue/queue.js';

describe('BullMQ job options', () => {
  it('uses exponential backoff and attempts=3', () => {
    expect(defaultJobOpts.attempts).toBe(3);
    expect(defaultJobOpts.backoff).toMatchObject({ type: 'exponential', delay: 500 });
  });
});
