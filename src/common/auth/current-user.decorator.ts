import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserContext } from './roles.js';

/**
 * Pulls `request.user` set by {@link UserContextGuard}. Use only on routes
 * guarded by `UserContextGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as UserContext;
  },
);
