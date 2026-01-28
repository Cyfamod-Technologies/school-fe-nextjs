"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PermissionGateProps {
  /**
   * The permission(s) required to render children.
   * Can be a single permission string or an array of permissions.
   * If array is provided, user needs at least ONE of the permissions (OR logic).
   */
  permission: string | string[];
  
  /**
   * Optional fallback content to render when permission is denied.
   * Defaults to null (nothing rendered).
   */
  fallback?: ReactNode;
  
  /**
   * The content to render when permission is granted.
   */
  children: ReactNode;
  
  /**
   * If true, requires ALL permissions instead of ANY (AND logic).
   * Default is false (OR logic).
   */
  requireAll?: boolean;
}

/**
 * PermissionGate Component
 * 
 * Conditionally renders children based on user permissions.
 * Uses the hasPermission function from AuthContext.
 * 
 * @example
 * // Single permission
 * <PermissionGate permission="students.create">
 *   <button>Add Student</button>
 * </PermissionGate>
 * 
 * @example
 * // Multiple permissions (OR logic - needs any one)
 * <PermissionGate permission={["students.create", "students.update"]}>
 *   <button>Manage Student</button>
 * </PermissionGate>
 * 
 * @example
 * // Multiple permissions (AND logic - needs all)
 * <PermissionGate permission={["students.view", "results.view"]} requireAll>
 *   <button>View Student Results</button>
 * </PermissionGate>
 * 
 * @example
 * // With fallback
 * <PermissionGate 
 *   permission="students.delete" 
 *   fallback={<span className="text-muted">No access</span>}
 * >
 *   <button>Delete Student</button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  fallback = null,
  children,
  requireAll = false,
}: PermissionGateProps): ReactNode {
  const { hasPermission } = useAuth();

  const permissions = Array.isArray(permission) ? permission : [permission];

  let hasAccess: boolean;

  if (requireAll) {
    // AND logic: user must have ALL permissions
    hasAccess = permissions.every((perm) => hasPermission(perm));
  } else {
    // OR logic: user needs at least ONE permission
    hasAccess = hasPermission(permissions);
  }

  if (!hasAccess) {
    return fallback;
  }

  return children;
}

/**
 * Hook to check permissions programmatically
 * 
 * @example
 * const { canCreate, canDelete } = usePermissions({
 *   canCreate: 'students.create',
 *   canDelete: 'students.delete',
 * });
 * 
 * if (canCreate) {
 *   // show create button
 * }
 */
export function usePermissions<T extends Record<string, string | string[]>>(
  permissionMap: T
): Record<keyof T, boolean> {
  const { hasPermission } = useAuth();

  const result = {} as Record<keyof T, boolean>;

  for (const key in permissionMap) {
    result[key] = hasPermission(permissionMap[key]);
  }

  return result;
}

/**
 * Higher-order component for permission-based rendering
 * 
 * @example
 * const ProtectedButton = withPermission(Button, 'students.create');
 * 
 * // Usage
 * <ProtectedButton>Add Student</ProtectedButton>
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string | string[],
  fallback: ReactNode = null
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGate permission={permission} fallback={fallback}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}

export default PermissionGate;
