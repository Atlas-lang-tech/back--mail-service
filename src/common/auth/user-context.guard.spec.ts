import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserContextGuard } from './user-context.guard.js';

function ctxWithHeaders(headers: Record<string, string>): ExecutionContext {
  const request: any = {
    header: (name: string) => headers[name.toLowerCase()],
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UserContextGuard', () => {
  const guard = new UserContextGuard();

  it('throws 401 when X-User-Id is missing', () => {
    const ctx = ctxWithHeaders({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('populates request.user with header values', () => {
    const ctx = ctxWithHeaders({
      'x-user-id': 'u-1',
      'x-user-role': 'ADMIN',
      'x-user-plan': 'PRO',
    });
    const request = ctx.switchToHttp().getRequest();

    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual({ id: 'u-1', role: 'ADMIN', plan: 'PRO' });
  });

  it('defaults role/plan when only id is present', () => {
    const ctx = ctxWithHeaders({ 'x-user-id': 'u-2' });
    const request = ctx.switchToHttp().getRequest();

    guard.canActivate(ctx);
    expect(request.user).toEqual({ id: 'u-2', role: 'USER', plan: 'FREE' });
  });
});
