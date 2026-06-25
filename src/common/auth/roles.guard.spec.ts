import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role } from './roles.js';

function ctxWithUser(user?: { role: string }): ExecutionContext {
  const request: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(required: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(ctxWithUser({ role: Role.USER }))).toBe(true);
  });

  it('allows when the required roles array is empty', () => {
    const guard = guardRequiring([]);
    expect(guard.canActivate(ctxWithUser({ role: Role.USER }))).toBe(true);
  });

  it('allows when the user has one of the required roles', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(guard.canActivate(ctxWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('forbids when the user role does not match', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(() => guard.canActivate(ctxWithUser({ role: Role.USER }))).toThrow(
      ForbiddenException,
    );
  });

  it('forbids when there is no authenticated user', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
