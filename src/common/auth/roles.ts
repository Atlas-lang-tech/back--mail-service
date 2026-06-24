// ESM-friendly: `as const` object instead of a TS enum. Mirrors the Role enum
// of the auth service.
export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface UserContext {
  id: string;
  role: Role;
  plan: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}
