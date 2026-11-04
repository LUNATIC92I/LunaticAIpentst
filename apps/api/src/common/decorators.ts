import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

/** Marks a route as not requiring authentication. */
export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Declares the permission keys required to access a route. */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const Permissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

export interface AuthenticatedUser {
  userId: string;
  orgId: string | null;
  permissions: string[];
}

/** Injects the authenticated user (populated by JwtAuthGuard). */
export const CurrentUser = createParamDecorator((_data, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
