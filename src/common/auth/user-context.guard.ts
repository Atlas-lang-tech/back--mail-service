import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from './roles.js';

/**
 * Reads the user context that the gateway (Traefik ForwardAuth) injects as
 * `X-User-*` headers and exposes it as `request.user`. The service never logs
 * users in itself.
 */
@Injectable()
export class UserContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const id = request.header('x-user-id');
    if (!id) throw new UnauthorizedException('Missing user context');

    request.user = {
      id,
      role: (request.header('x-user-role') ?? 'USER') as Role,
      plan: request.header('x-user-plan') ?? 'FREE',
    };

    return true;
  }
}
