export type RoleLikeUser = {
  role?: string | null;
  roles?: Array<{ name?: string | null }> | null;
} | null | undefined;

const normalizeRoleName = (value?: string | null): string =>
  String(value ?? "").trim().toLowerCase();

export const userHasRole = (user: RoleLikeUser, roleName: string): boolean => {
  const target = normalizeRoleName(roleName);
  if (!target) {
    return false;
  }

  if (normalizeRoleName(user?.role) === target) {
    return true;
  }

  const roles = user?.roles;
  if (!Array.isArray(roles)) {
    return false;
  }

  return roles.some((role) => normalizeRoleName(role?.name) === target);
};

export const isTeacherUser = (user: RoleLikeUser): boolean =>
  userHasRole(user, "teacher");
