import { jest } from '@jest/globals';

// ---- ESM module mock for ioredis (default export is the client ctor) ----
const clientMock = {
  get: jest.fn<(k: string) => Promise<string | null>>(),
  set: jest.fn<(...a: any[]) => Promise<string | null>>(),
  del: jest.fn<(k: string) => Promise<number>>(),
  exists: jest.fn<(k: string) => Promise<number>>(),
  expire: jest.fn<(...a: any[]) => Promise<number>>(),
  keys: jest.fn<(p: string) => Promise<string[]>>(),
  disconnect: jest.fn(),
};
const RedisCtor = jest.fn().mockImplementation(() => clientMock);

jest.unstable_mockModule('ioredis', () => ({ default: RedisCtor }));

const { RedisService } = await import('./redis.service.js');

describe('RedisService', () => {
  let service: InstanceType<typeof RedisService>;

  beforeEach(() => {
    Object.values(clientMock).forEach((m) => (m as jest.Mock).mockReset());
    RedisCtor.mockClear();
    service = new RedisService();
  });

  it('reads a key via get', async () => {
    clientMock.get.mockResolvedValueOnce('value');
    await expect(service.get('k')).resolves.toBe('value');
    expect(clientMock.get).toHaveBeenCalledWith('k');
  });

  it('sets a key with TTL using EX', async () => {
    await service.set('k', 'v', 30);
    expect(clientMock.set).toHaveBeenCalledWith('k', 'v', 'EX', 30);
  });

  it('sets a key without TTL', async () => {
    await service.set('k', 'v');
    expect(clientMock.set).toHaveBeenCalledWith('k', 'v');
  });

  it('setNx returns true when the key was created', async () => {
    clientMock.set.mockResolvedValueOnce('OK');
    await expect(service.setNx('k', 'v', 60)).resolves.toBe(true);
    expect(clientMock.set).toHaveBeenCalledWith('k', 'v', 'EX', 60, 'NX');
  });

  it('setNx returns false when the key already existed', async () => {
    clientMock.set.mockResolvedValueOnce(null);
    await expect(service.setNx('k', 'v', 60)).resolves.toBe(false);
  });

  it('exists maps a count of 1 to true and 0 to false', async () => {
    clientMock.exists.mockResolvedValueOnce(1);
    await expect(service.exists('k')).resolves.toBe(true);
    clientMock.exists.mockResolvedValueOnce(0);
    await expect(service.exists('k')).resolves.toBe(false);
  });

  it('delegates del, expire and keys to the client', async () => {
    await service.del('k');
    expect(clientMock.del).toHaveBeenCalledWith('k');

    await service.expire('k', 10);
    expect(clientMock.expire).toHaveBeenCalledWith('k', 10);

    clientMock.keys.mockResolvedValueOnce(['a', 'b']);
    await expect(service.keys('a*')).resolves.toEqual(['a', 'b']);
  });

  it('disconnects the client on module destroy', () => {
    service.onModuleDestroy();
    expect(clientMock.disconnect).toHaveBeenCalledTimes(1);
  });
});
