import { PermissionResolvable, Permissions } from 'discord.js';

export function plural<N extends number, T extends string>(
  count: N,
  type: T
): N extends 1 ? `${N} ${T}` : `${N} ${T}s` {
  return (count === 1 ? `${count} ${type}` : `${count} ${type}s`) as N extends 1 ? `${N} ${T}` : `${N} ${T}s`;
}

export function resolvePermissions(arg: PermissionResolvable | Permissions | string): Permissions {
  if (typeof arg === 'string') {
    return new Permissions(BigInt(arg));
  } else if (arg instanceof Permissions) {
    return arg;
  } else {
    return new Permissions(arg);
  }
}
