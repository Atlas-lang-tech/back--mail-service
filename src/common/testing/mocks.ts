import { jest } from '@jest/globals';

type ModelDelegate = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
};

function createModelMock(): ModelDelegate {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
}

/**
 * Minimal Prisma mock. Add new models here as the schema grows.
 * `$transaction` runs the callback inline against the mock itself.
 */
export function createMockPrisma() {
  const mock: Record<string, unknown> = {
    mailLog: createModelMock(),
  };

  mock.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mock) : arg,
  );

  return mock;
}

/**
 * Redis mock — defaults to a cache miss (`get` resolves to `null`).
 */
export function createMockRedis() {
  return {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    setNx: jest.fn(async () => true),
    del: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
    expire: jest.fn(async () => undefined),
    keys: jest.fn(async () => [] as string[]),
  };
}
