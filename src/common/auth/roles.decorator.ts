import { Reflector } from '@nestjs/core';

/**
 * `@Roles([Role.ADMIN])` on a class or handler. Enforced by {@link RolesGuard}.
 */
export const Roles = Reflector.createDecorator<string[]>();
