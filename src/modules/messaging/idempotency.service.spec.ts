import { createMockRedis } from '../../common/testing/mocks.js';
import { IdempotencyService } from './idempotency.service.js';

describe('IdempotencyService.alreadyProcessed', () => {
  let cache: ReturnType<typeof createMockRedis>;
  let service: IdempotencyService;

  beforeEach(() => {
    cache = createMockRedis();
    service = new IdempotencyService(cache as any);
  });

  it('processes (returns false) when no messageId is given', async () => {
    const result = await service.alreadyProcessed(undefined);

    expect(result).toBe(false);
    expect(cache.setNx).not.toHaveBeenCalled();
  });

  it('returns false for a first-seen event and claims the key for 24h', async () => {
    cache.setNx.mockResolvedValueOnce(true as never); // key created → first win

    const result = await service.alreadyProcessed('msg-1');

    expect(result).toBe(false);
    expect(cache.setNx).toHaveBeenCalledWith('event:msg-1', '1', 60 * 60 * 24);
  });

  it('returns true for a redelivered event (key already existed)', async () => {
    cache.setNx.mockResolvedValueOnce(false as never); // key existed → duplicate

    const result = await service.alreadyProcessed('msg-1');

    expect(result).toBe(true);
  });
});
