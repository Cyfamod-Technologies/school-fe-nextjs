"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSION_ACTIONS } from "@/lib/permissionCatalog";
import {
  listPermissions,
  type Permission,
} from "@/lib/permissions";
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
  type Role,
} from "@/lib/roles";

type FeedbackType = "success" | "warning" | "danger";

interface FeedbackState {
  type: FeedbackType;
  message: string;
}

interface PermissionActionItem {
  id: string;
  permission: Permission | null;
  permissionId: string | null;
  permissionKey: string;
  functionLabel: string;
  description: string;
  subtitle?: string | null;
}

interface PermissionGroup {
  key: string;
  title: string;
  items: PermissionActionItem[];
  icon?: string;
  color?: string;
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const normalizeLabel = (value: string): string =>
  value.replace(/[-_.]/g, " ").replace(/\s+/g, " ").trim();

const toTitle = (value: string): string =>
  normalizeLabel(value).replace(/\b\w/g, (char) => char.toUpperCase());

const formatPermissionLabels = (permissionName: string): {
  groupKey: string;
  groupTitle: string;
  primaryLabel: string;
  subtitle: string | null;
} => {
  const rawParts = permissionName.split(".").filter((part) => part.trim().length > 0);
  const groupPart = rawParts.length > 0 ? rawParts[0] : "general";
  const contextParts = rawParts.length > 1 ? rawParts.slice(0, rawParts.length - 1) : [];
  let actionPart =
    rawParts.length > 1 ? rawParts[rawParts.length - 1] : rawParts[0] ?? "general";

  // Map "update" to "Edit" for better UX
  if (actionPart === "update") {
    actionPart = "edit";
  }
  // Normalize "enter" action to "Entry" for UX consistency
  if (actionPart === "enter") {
    actionPart = "entry";
  }

  const subtitle =
    contextParts.length > 0 ? toTitle(contextParts.join(" ")) : groupPart === "general" ? null : toTitle(groupPart);

  return {
    groupKey: groupPart || "general",
    groupTitle: (groupPart || "general").replace(/[-_]/g, " "),
    primaryLabel: toTitle(actionPart),
    subtitle,
  };
};

interface PermissionGroupTemplate {
  key: string;
  title: string;
  patterns: Array<string | RegExp>;
  icon?: string;
  color?: string;
  sections?: Array<{
    label: string;
    patterns: Array<string | RegExp>;
  }>;
}

const SIDEBAR_PERMISSION_GROUPS: PermissionGroupTemplate[] = [
  {
    key: "management",
    title: "Management",
    patterns: [],
    icon: "fas fa-cogs",
    color: "#6366f1",
    sections: [
      { label: "Sessions", patterns: ["sessions."] },
      { label: "Terms", patterns: ["terms."] },
      { label: "Subjects", patterns: ["subjects."] },
      { label: "Result Pin", patterns: ["result.pin."] },
      { label: "Academic Rollover", patterns: ["academic.rollover."] },
    ],
  },
  {
    key: "parent",
    title: "Parent",
    patterns: ["parents."],
    icon: "fas fa-user-friends",
    color: "#ec4899",
  },
  {
    key: "staff",
    title: "Staff",
    patterns: ["staff."],
    icon: "fas fa-user-tie",
    color: "#8b5cf6",
  },
  {
    key: "classes",
    title: "Classes",
    patterns: ["classes.", "class-arms."],
    icon: "fas fa-chalkboard",
    color: "#f59e0b",
  },
  {
    key: "assign",
    title: "Assign",
    patterns: ["subject.assignments", "teacher.assignments.", "class-teachers."],
    icon: "fas fa-tasks",
    color: "#10b981",
  },
  {
    key: "student",
    title: "Student",
    patterns: ["students.", "student."],
    icon: "fas fa-user-graduate",
    color: "#3b82f6",
  },
  {
    key: "results",
    title: "Results",
    patterns: ["results.", "assessment.", "skills.", "settings.result-page."],
    icon: "fas fa-poll",
    color: "#14b8a6",
  },
  {
    key: "attendance",
    title: "Attendance",
    patterns: ["attendance."],
    icon: "fas fa-calendar-check",
    color: "#06b6d4",
  },
  {
    key: "settings",
    title: "Settings",
    patterns: ["settings.school."],
    icon: "fas fa-sliders-h",
    color: "#64748b",
  },
  {
    key: "finance",
    title: "Finance",
    patterns: ["finance."],
    icon: "fas fa-wallet",
    color: "#22c55e",
  },
  {
    key: "cbt",
    title: "CBT",
    patterns: ["cbt."],
    icon: "fas fa-laptop",
    color: "#a855f7",
  },
  {
    key: "rbac",
    title: "RBAC",
    patterns: ["roles.", "user-roles."],
    icon: "fas fa-shield-alt",
    color: "#ef4444",
  },
  {
    key: "analytics",
    title: "Analytics",
    patterns: ["analytics."],
    icon: "fas fa-chart-line",
    color: "#0ea5e9",
  },
];

const matchesPattern = (permissionName: string, pattern: string | RegExp): boolean => {
  if (pattern instanceof RegExp) {
    return pattern.test(permissionName);
  }
  if (pattern.endsWith(".")) {
    return permissionName.startsWith(pattern);
  }
  return (
    permissionName === pattern ||
    permissionName.startsWith(`${pattern}.`)
  );
};

const filterPermissionActionsByTerm = (
  items: PermissionActionItem[],
  term: string,
): PermissionActionItem[] => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return items;
  }
  return items.filter((item) => {
    const name = String(item.permissionKey ?? "").toLowerCase();
    const description = String(item.description ?? "").toLowerCase();
    const functionLabel = String(item.functionLabel ?? "").toLowerCase();
    return (
      name.includes(normalized) ||
      description.includes(normalized) ||
      functionLabel.includes(normalized)
    );
  });
};

const collectPermissionGroups = (
  items: PermissionActionItem[],
  filterTerm: string,
): PermissionGroup[] => {
  let remaining = filterPermissionActionsByTerm(items, filterTerm);
  const groups: PermissionGroup[] = [];

  SIDEBAR_PERMISSION_GROUPS.forEach((template) => {
    const sectionEntries: PermissionGroup[] = [];
    let matchedIds = new Set<string>();

    const processSection = (sectionLabel: string | null, patterns: Array<string | RegExp>) => {
      const sectionMatches = remaining.filter((item) => {
        const name = String(item.permissionKey ?? "");
        return patterns.some((pattern) => matchesPattern(name, pattern));
      });

      if (!sectionMatches.length) {
        return;
      }

      matchedIds = new Set([...matchedIds, ...sectionMatches.map((item) => item.id)]);

      sectionEntries.push({
        key: sectionLabel ? `${template.key}-${sectionLabel.toLowerCase().replace(/\s+/g, "-")}` : template.key,
        title: sectionLabel ?? template.title,
        items: sectionMatches
          .slice()
          .sort((a, b) => {
            // Custom sort order: view, create, edit/update, delete, then others alphabetically
            const getOrder = (label: string, key: string): number => {
              const lowerLabel = label.toLowerCase();
              const lowerKey = key.toLowerCase();
              if (lowerLabel.startsWith("view") || lowerKey.endsWith(".view")) return 0;
              if (lowerLabel.startsWith("create") || lowerKey.endsWith(".create")) return 1;
              if (lowerLabel.startsWith("edit") || lowerLabel.startsWith("update") || lowerKey.endsWith(".update")) return 2;
              if (lowerLabel.startsWith("delete") || lowerKey.endsWith(".delete")) return 3;
              return 4;
            };
            const orderA = getOrder(a.functionLabel, a.permissionKey);
            const orderB = getOrder(b.functionLabel, b.permissionKey);
            if (orderA !== orderB) return orderA - orderB;
            return a.functionLabel.localeCompare(b.functionLabel);
          }),
      });
    };

    if (Array.isArray(template.sections) && template.sections.length) {
      template.sections.forEach((section) => {
        processSection(section.label, section.patterns);
      });
    }

    if (template.patterns.length) {
      processSection(template.sections && template.sections.length ? "Other" : null, template.patterns);
    }

    if (!sectionEntries.length) {
      return;
    }

    sectionEntries.forEach((entry) => groups.push(entry));

    remaining = remaining.filter(
      (item) => !matchedIds.has(item.id),
    );
  });

  if (remaining.length > 0) {
    const fallbackMap = new Map<string, PermissionGroup>();

    remaining.forEach((item) => {
      const name = String(item.permissionKey ?? "");
      const { groupKey, groupTitle, primaryLabel, subtitle } = formatPermissionLabels(name);
      const entry =
        fallbackMap.get(groupKey) ??
        {
          key: groupKey,
          title: groupTitle,
          items: [] as PermissionActionItem[],
        };

      entry.items.push({
        ...item,
        functionLabel: item.functionLabel || primaryLabel,
        subtitle: item.subtitle ?? subtitle,
      });

      fallbackMap.set(groupKey, entry);
    });

    const fallbackGroups = Array.from(fallbackMap.values()).map((group) => ({
      key: `other-${group.key}`,
      title: group.key === "general" ? "Other" : group.title,
      items: group.items.sort((a, b) => {
        // Custom sort order: view, create, edit/update, delete, then others alphabetically
        const getOrder = (label: string, key: string): number => {
          const lowerLabel = label.toLowerCase();
          const lowerKey = key.toLowerCase();
          if (lowerLabel.startsWith("view") || lowerKey.endsWith(".view")) return 0;
          if (lowerLabel.startsWith("create") || lowerKey.endsWith(".create")) return 1;
          if (lowerLabel.startsWith("edit") || lowerLabel.startsWith("update") || lowerKey.endsWith(".update")) return 2;
          if (lowerLabel.startsWith("delete") || lowerKey.endsWith(".delete")) return 3;
          return 4;
        };
        const orderA = getOrder(a.functionLabel, a.permissionKey);
        const orderB = getOrder(b.functionLabel, b.permissionKey);
        if (orderA !== orderB) return orderA - orderB;
        return a.functionLabel.localeCompare(b.functionLabel);
      }),
    }));

    groups.push(
      ...fallbackGroups.sort((a, b) => a.title.localeCompare(b.title)),
    );
  }

  return groups;
};

const summarizeRolePermissions = (role: Role): ReactNode => {
  const permissions = Array.isArray(role.permissions)
    ? role.permissions
    : [];
  if (permissions.length === 0) {
    return <span className="badge badge-secondary">None</span>;
  }

  const names = permissions
    .map((permission) =>
      typeof permission?.name === "string" ? permission.name : "",
    )
    .filter((value) => value.trim().length > 0);

  if (!names.length) {
    return <span className="badge badge-secondary">None</span>;
  }

  const preview = names.slice(0, 3).join(", ");
  const remaining = names.length - 3;

  return (
    <>
      {preview}
      {remaining > 0 ? (
        <span className="text-muted"> (+{remaining} more)</span>
      ) : null}
    </>
  );
};

const containsManageTerm = (...values: Array<string | null | undefined>): boolean => {
  const text = values
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0)
    .join(" ")
    .toLowerCase();

  return text.includes("manage");
};

const ALLOWED_STAFF_PERMISSIONS = new Set([
  "staff.view",
  "staff.create",
  "staff.update",
  "staff.delete",
]);

const shouldHidePermissionKey = (permissionKey: string): boolean => {
  const normalized = permissionKey.trim().toLowerCase();
  if (normalized.startsWith("staff.") && !ALLOWED_STAFF_PERMISSIONS.has(normalized)) {
    return true;
  }
  return false;
};

const buildPermissionActionItems = (
  permissions: Permission[],
): PermissionActionItem[] => {
  const permissionByKey = new Map<string, Permission>();
  permissions.forEach((permission) => {
    const name = String(permission?.name ?? "");
    if (name) {
      permissionByKey.set(name, permission);
    }
  });

  const actionItems: PermissionActionItem[] = [];
  PERMISSION_ACTIONS.forEach((entry, index) => {
    const permissionKey = String(entry.permission ?? "");
    const permission = permissionByKey.get(permissionKey) ?? null;
    const functionLabel = String(entry.function ?? "").trim() || permissionKey;
    const description = String(entry.description ?? "").trim();

    if (
      containsManageTerm(functionLabel, description, permissionKey) ||
      shouldHidePermissionKey(permissionKey)
    ) {
      return;
    }

    const permissionId =
      permission && permission.id !== undefined && permission.id !== null
        ? String(permission.id)
        : null;
    const { subtitle } = formatPermissionLabels(permissionKey);
    actionItems.push({
      id: `action-${index}`,
      permission,
      permissionId,
      permissionKey,
      functionLabel,
      description,
      subtitle,
    });
  });

  const catalogKeys = new Set(
    PERMISSION_ACTIONS.map((entry) => String(entry.permission ?? "")),
  );
  permissions.forEach((permission) => {
    const permissionKey = String(permission?.name ?? "");
    if (!permissionKey || catalogKeys.has(permissionKey)) {
      return;
    }
    const { primaryLabel, subtitle } = formatPermissionLabels(permissionKey);
    const functionLabel = subtitle ? `${primaryLabel} ${subtitle}` : primaryLabel;
    const description = String(permission?.description ?? "").trim();

    if (
      containsManageTerm(functionLabel, description, permissionKey) ||
      shouldHidePermissionKey(permissionKey)
    ) {
      return;
    }

    actionItems.push({
      id: `fallback-${permissionKey}`,
      permission,
      permissionId:
        permission.id !== undefined && permission.id !== null
          ? String(permission.id)
          : null,
      permissionKey,
      functionLabel,
      description,
      subtitle,
    });
  });

  return actionItems;
};

export default function RolesPage() {
  const { hasPermission, user } = useAuth();
  const isAdmin = useMemo(() => {
    const directRole = String((user as { role?: string | null })?.role ?? "").toLowerCase();
    if (directRole === "admin") {
      return true;
    }
    const roles = (user as { roles?: Array<{ name?: string | null }> })?.roles;
    if (Array.isArray(roles)) {
      return roles.some((role) => String(role?.name ?? "").toLowerCase() === "admin");
    }
    return false;
  }, [user]);
  const canViewRoles = isAdmin || hasPermission("roles.view");
  const canCreateRole = isAdmin || hasPermission("roles.create");
  const canUpdateRole = isAdmin || hasPermission("roles.update");
  const canDeleteRole = isAdmin || hasPermission("roles.delete");
  const canAssignPermissions = isAdmin || hasPermission("roles.permissions.assign");

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [permissionFilter, setPermissionFilter] = useState<string>("");

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [roleName, setRoleName] = useState<string>("");
  const [roleDescription, setRoleDescription] = useState<string>("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | string | null>(
    null,
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const normalizeRoleName = useCallback((name: string): string => {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }, []);

  const isSystemRoleName = useCallback((name: string): boolean => {
    const n = normalizeRoleName(name);
    // disallow admin and super_admin variants
    return n === "admin" || n === "super_admin";
  }, [normalizeRoleName]);

  const isLockedRoleName = useCallback((name: string): boolean => {
    const n = normalizeRoleName(name);
    return n === "teacher" || isSystemRoleName(n);
  }, [isSystemRoleName, normalizeRoleName]);

  const showFeedback = useCallback(
    (message: string, type: FeedbackType) => {
      setFeedback({ message, type });
    },
    [],
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const loadPermissions = useCallback(async () => {
    if (!canAssignPermissions) {
      setPermissionsLoading(false);
      setPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    try {
      // The backend now auto-seeds permissions when listing
      // So we just need to fetch them - no separate sync needed
      const response = await listPermissions({ per_page: 300 });
      setPermissions(response.data ?? []);
    } catch (error) {
      console.error("Unable to load permissions", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load permissions. Please try again.",
        "danger",
      );
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, [canAssignPermissions, showFeedback]);

  const loadRoles = useCallback(async () => {
    if (!canViewRoles) {
      setRolesLoading(false);
      setRolesError("You do not have permission to view roles.");
      setRoles([]);
      return;
    }
    setRolesLoading(true);
    setRolesError(null);
    try {
      const response = await listRoles({
        per_page: 200,
      });
      setRoles(response.data ?? []);
    } catch (error) {
      console.error("Unable to load roles", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load roles. Please try again.";
      setRolesError(message);
      showFeedback(message, "danger");
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, [canViewRoles, showFeedback]);

  const handleSyncPermissions = useCallback(async () => {
    if (!canAssignPermissions) {
      return;
    }
    setSyncing(true);
    try {
      // Force refresh permissions (backend auto-seeds if needed)
      const response = await listPermissions({ per_page: 300 });
      setPermissions(response.data ?? []);
      showFeedback("Permissions refreshed successfully.", "success");
    } catch (error) {
      console.error("Unable to refresh permissions", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to refresh permissions. Please try again.",
        "danger",
      );
    } finally {
      setSyncing(false);
    }
  }, [canAssignPermissions, showFeedback]);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadPermissions(), loadRoles()]);
    })();
  }, [loadPermissions, loadRoles]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const body = document.body;
    if (modalOpen) {
      body.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
    }
    return () => {
      body.classList.remove("modal-open");
    };
  }, [modalOpen]);

  const filteredRoles = useMemo(() => {
    if (!searchTerm) {
      return roles;
    }
    const term = searchTerm.toLowerCase();
    return roles.filter((role) => {
      const nameMatches = (role.name ?? "").toLowerCase().includes(term);
      const descriptionMatches = (role.description ?? "")
        .toLowerCase()
        .includes(term);
      const permissionMatches = Array.isArray(role.permissions)
        ? role.permissions.some((permission) =>
            String(permission?.name ?? "").toLowerCase().includes(term),
          )
        : false;
      return nameMatches || descriptionMatches || permissionMatches;
    });
  }, [roles, searchTerm]);

  const permissionActionItems = useMemo(() => {
    if (permissionsLoading) {
      return [];
    }
    return buildPermissionActionItems(permissions);
  }, [permissions, permissionsLoading]);

  const groupedPermissions = useMemo<PermissionGroup[]>(() => {
    if (permissionsLoading) {
      return [];
    }
    return collectPermissionGroups(permissionActionItems, permissionFilter);
  }, [permissionActionItems, permissionFilter, permissionsLoading]);

  const selectedPermissionsCount = selectedPermissionIds.size;
  const visibleRoleCount = filteredRoles.length;
  const totalRolesCount = roles.length;
  const permissionCountLabel = canAssignPermissions
    ? String(permissionActionItems.length)
    : "Restricted";

  const openCreateModal = () => {
    if (!canCreateRole) {
      return;
    }
    setModalMode("create");
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissionIds(new Set());
    setPermissionFilter("");
    setFormError(null);
    setExpandedGroups(new Set());
    setModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    if (!canUpdateRole) {
      return;
    }
    if (isLockedRoleName(role.name ?? "")) {
      return;
    }
    setModalMode("edit");
    setEditingRole(role);
    setRoleName(role.name ?? "");
    setRoleDescription(role.description ?? "");
    const permissionIds = new Set<string>();
    if (Array.isArray(role.permissions)) {
      role.permissions.forEach((permission) => {
        if (permission?.id !== undefined && permission?.id !== null) {
          permissionIds.add(String(permission.id));
        }
      });
    }
    setSelectedPermissionIds(permissionIds);
    setPermissionFilter("");
    setFormError(null);
    setExpandedGroups(new Set());
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRole(null);
    setSaving(false);
    setFormError(null);
  };

  const isLockedPermission = useCallback((_permission: Permission): boolean => {
    void _permission;
    return false;
  }, []);

  const toggleGroupExpanded = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Helper to find the "view" permission item in a group
  const findViewPermissionInGroup = useCallback((group: PermissionGroup): PermissionActionItem | null => {
    return group.items.find((item) => {
      const key = item.permissionKey.toLowerCase();
      const label = item.functionLabel.toLowerCase();
      return key.endsWith(".view") || label.startsWith("view");
    }) ?? null;
  }, []);

  // Helper to check if the view permission is enabled for a group
  const isViewPermissionEnabled = useCallback((group: PermissionGroup): boolean => {
    const viewItem = findViewPermissionInGroup(group);
    if (!viewItem || !viewItem.permissionId) return true; // If no view permission, don't block others
    return selectedPermissionIds.has(viewItem.permissionId);
  }, [findViewPermissionInGroup, selectedPermissionIds]);

  // Helper to check if a permission item is a "view" permission
  const isViewPermission = useCallback((item: PermissionActionItem): boolean => {
    const key = item.permissionKey.toLowerCase();
    const label = item.functionLabel.toLowerCase();
    return key.endsWith(".view") || label.startsWith("view");
  }, []);

  const toggleAllGroupPermissions = useCallback((group: PermissionGroup, checked: boolean) => {
    if (!canAssignPermissions) return;
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      group.items.forEach((item) => {
        if (!item.permissionId) return;
        const permission = item.permission;
        const isLocked = permission ? isLockedPermission(permission) : false;
        if (isLocked && !checked) return; // Don't uncheck locked permissions
        if (checked) {
          next.add(item.permissionId);
        } else {
          next.delete(item.permissionId);
        }
      });
      return next;
    });
  }, [canAssignPermissions, isLockedPermission]);

  const getGroupSelectionState = useCallback((group: PermissionGroup): "all" | "some" | "none" => {
    const selectableItems = group.items.filter((item) => item.permissionId);
    if (selectableItems.length === 0) return "none";
    const selectedCount = selectableItems.filter((item) => 
      item.permissionId && selectedPermissionIds.has(item.permissionId)
    ).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === selectableItems.length) return "all";
    return "some";
  }, [selectedPermissionIds]);

  const togglePermissionSelection = (
    permissionId: string | null,
    checked: boolean,
    permission?: Permission | null,
    group?: PermissionGroup | null,
    item?: PermissionActionItem | null,
  ) => {
    if (!permissionId) {
      return;
    }
    if (!canAssignPermissions) {
      return;
    }
    // Prevent unchecking locked permissions for teacher role
    if (!checked && permission && isLockedPermission(permission)) {
      return;
    }
    setSelectedPermissionIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(permissionId);
        // If enabling a non-view permission, also enable the view permission
        if (group && item && !isViewPermission(item)) {
          const viewItem = findViewPermissionInGroup(group);
          if (viewItem?.permissionId) {
            next.add(viewItem.permissionId);
          }
        }
      } else {
        next.delete(permissionId);
        // If disabling the view permission, also disable create/edit/delete
        if (group && item && isViewPermission(item)) {
          group.items.forEach((groupItem) => {
            if (groupItem.permissionId && !isViewPermission(groupItem)) {
              // Don't remove locked permissions
              const isLocked = groupItem.permission ? isLockedPermission(groupItem.permission) : false;
              if (!isLocked) {
                next.delete(groupItem.permissionId);
              }
            }
          });
        }
      }
      return next;
    });
  };

  const handleSubmitRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = roleName.trim();
    const trimmedDescription = roleDescription.trim();

    if (trimmedName.length === 0) {
      setFormError("Role name is required.");
      return;
    }

    if (isSystemRoleName(trimmedName)) {
      setFormError("Role name cannot contain 'admin' or 'super_admin'.");
      return;
    }
    if (modalMode === "edit" && !canUpdateRole) {
      setFormError("You do not have permission to update roles.");
      return;
    }
    if (modalMode === "create" && !canCreateRole) {
      setFormError("You do not have permission to create roles.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const basePayload = {
        name: trimmedName,
        description: trimmedDescription || null,
      };
      const permissionsPayload = canAssignPermissions
        ? Array.from(selectedPermissionIds).map((value) => {
            const numeric = Number(value);
            return Number.isNaN(numeric) ? value : numeric;
          })
        : undefined;
      const payload = canAssignPermissions
        ? { ...basePayload, permissions: permissionsPayload }
        : basePayload;

      if (modalMode === "edit" && editingRole) {
        await updateRole(editingRole.id, payload);
        showFeedback("Role updated successfully.", "success");
      } else {
        await createRole(payload);
        showFeedback("Role created successfully.", "success");
      }

      setSearchTerm("");
      closeModal();
      await Promise.all([loadRoles(), loadPermissions()]);
    } catch (error) {
      console.error("Unable to save role", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save role. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!canDeleteRole) {
      return;
    }
    if (isLockedRoleName(role.name ?? "")) {
      showFeedback("This role is locked and cannot be deleted.", "warning");
      return;
    }
    const confirmationMessage = role.name
      ? `Are you sure you want to delete the role "${role.name}"?`
      : "Are you sure you want to delete this role?";
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setDeletingRoleId(role.id);
    clearFeedback();
    try {
      await deleteRole(role.id);
      showFeedback("Role deleted successfully.", "success");
      setSearchTerm("");
      await loadRoles();
    } catch (error) {
      console.error("Unable to delete role", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to delete role. Please try again.",
        "danger",
      );
    } finally {
      setDeletingRoleId(null);
    }
  };

  const tableMessage = useMemo(() => {
    if (rolesLoading) {
      return "Loading roles...";
    }
    if (rolesError) {
      return rolesError;
    }
    if (!filteredRoles.length) {
      return searchTerm
        ? "No roles match your search."
        : "No roles found.";
    }
    return null;
  }, [filteredRoles.length, rolesError, rolesLoading, searchTerm]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Role Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Roles</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="rbac-hero">
            <div className="rbac-hero-main">
              <span className="rbac-kicker">Access control</span>
              <h3>Roles &amp; Permissions</h3>
              <p>
                Design roles and assign precise access across the system.
              </p>
            </div>
            <div className="rbac-hero-stats">
              <div className="rbac-stat">
                <span className="rbac-stat-label">Roles</span>
                <span className="rbac-stat-value">{totalRolesCount}</span>
              </div>
              <div className="rbac-stat">
                <span className="rbac-stat-label">Visible</span>
                <span className="rbac-stat-value">{visibleRoleCount}</span>
              </div>
              <div className="rbac-stat">
                <span className="rbac-stat-label">Permissions</span>
                <span className="rbac-stat-value">{permissionCountLabel}</span>
              </div>
            </div>
          </div>

          <div className="rbac-toolbar-section">
            <div className="rbac-toolbar-left">
              <h4 className="rbac-section-title">
                <i className="fas fa-user-shield" />
                All Roles
              </h4>
            </div>
            <div className="rbac-toolbar-right">
              <div className="rbac-search-wrapper">
                <i className="fas fa-search rbac-search-icon" />
                <input
                  type="text"
                  className="rbac-search-input"
                  id="roleSearch"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="rbac-search-clear"
                    onClick={() => setSearchTerm("")}
                    title="Clear search"
                  >
                    <i className="fas fa-times" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="rbac-create-btn"
                id="addRoleBtn"
                onClick={openCreateModal}
                disabled={!canCreateRole}
                title={
                  canCreateRole
                    ? "Create a new role"
                    : "You do not have permission to create roles."
                }
              >
                <i className="fas fa-plus" />
                <span>Create Role</span>
              </button>
              {canAssignPermissions && (
                <button
                  type="button"
                  className="rbac-sync-btn"
                  onClick={handleSyncPermissions}
                  disabled={syncing}
                  title="Refresh permissions list"
                >
                  <i className={`fas fa-sync-alt ${syncing ? "fa-spin" : ""}`} />
                  <span>{syncing ? "Refreshing..." : "Refresh"}</span>
                </button>
              )}
            </div>
          </div>

          <div id="rolesAlert">
            {feedback ? (
              <div
                className={`alert alert-${feedback.type} alert-dismissible fade show`}
                role="alert"
              >
                {feedback.message}
                <button
                  type="button"
                  className="close"
                  aria-label="Close"
                  onClick={clearFeedback}
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
            ) : null}
          </div>
          {!canViewRoles ? (
            <div className="alert alert-warning" role="alert">
              You do not have permission to view roles.
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap rbac-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableMessage ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={`text-center py-4 ${
                        rolesLoading ? "" : "text-muted"
                      }`}
                    >
                      {rolesLoading ? (
                        <div className="d-flex flex-column align-items-center">
                          <div className="table-loader mb-2" />
                          <span>Loading roles...</span>
                        </div>
                      ) : (
                        tableMessage
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => {
                    const permissionCount = Array.isArray(role.permissions) ? role.permissions.length : 0;
                    const isLockedRole = isLockedRoleName(role.name || "");
                    return (
                      <tr key={String(role.id)} className={isLockedRole ? "system-role-row" : ""}>
                        <td>
                          <div className="role-name-cell">
                            <span className="role-name">{role.name}</span>
                            {isLockedRole && (
                              <span className="role-system-badge">
                                <i className="fas fa-shield-alt" /> System
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="role-description">{role.description || "No description"}</span>
                        </td>
                        <td>
                          <div className="permission-count-badge">
                            <i className="fas fa-key" />
                            <span>{permissionCount} permission{permissionCount !== 1 ? "s" : ""}</span>
                          </div>
                        </td>
                        <td>
                          <span className="role-updated">{formatDateTime(role.updated_at)}</span>
                        </td>
                        <td className="text-right">
                          {isLockedRole ? (
                            <span className="role-locked-indicator" title="Locked roles cannot be edited or deleted">
                              <i className="fas fa-lock" />
                            </span>
                          ) : !canUpdateRole && !canDeleteRole ? (
                            <span className="text-muted">No access</span>
                          ) : (
                            <div className="role-action-buttons">
                              {canUpdateRole && (
                                <button
                                  type="button"
                                  className="role-action-btn edit"
                                  onClick={() => openEditModal(role)}
                                  title="Edit role"
                                >
                                  <i className="fas fa-pen" />
                                </button>
                              )}
                              {canDeleteRole && (
                                <button
                                  type="button"
                                  className="role-action-btn delete"
                                  onClick={() => void handleDeleteRole(role)}
                                  disabled={deletingRoleId === role.id}
                                  title="Delete role"
                                >
                                  <i className={deletingRoleId === role.id ? "fas fa-spinner fa-spin" : "fas fa-trash-alt"} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1">
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>

      <div
        className={`modal fade${modalOpen ? " show" : ""}`}
        role="dialog"
        style={{
          display: modalOpen ? "block" : "none",
          backgroundColor: modalOpen ? "rgba(0, 0, 0, 0.5)" : undefined,
        }}
        {...(modalOpen ? {} : { "aria-hidden": true })}
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content rbac-modal">
            <div className="modal-header">
              <h5 className="modal-title" id="roleModalTitle">
                {modalMode === "edit" ? "Edit Role" : "Create Role"}
              </h5>
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={closeModal}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <form id="roleForm" onSubmit={handleSubmitRole}>
              <div className="modal-body">
                {formError ? (
                  <div className="alert alert-danger" role="alert">
                    {formError}
                  </div>
                ) : null}
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label htmlFor="roleName">
                      Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="roleName"
                      maxLength={150}
                      value={roleName}
                      onChange={(event) => {
                        setRoleName(event.target.value);
                      }}
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label htmlFor="roleDescription">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      id="roleDescription"
                      maxLength={255}
                      value={roleDescription}
                      onChange={(event) => {
                        setRoleDescription(event.target.value);
                      }}
                      disabled={saving}
                    />
                  </div>
                  <div className="col-md-12 form-group">
                    <div className="permission-section-header">
                      <div className="permission-section-title">
                        <i className="fas fa-key" />
                        <span>Permissions</span>
                        <span className="permission-badge-count">
                          {selectedPermissionsCount} selected
                        </span>
                      </div>
                      <div className="permission-search-wrapper">
                        <i className="fas fa-filter permission-search-icon" />
                        <input
                          type="text"
                          className="permission-search-input"
                          id="permissionSearch"
                          placeholder="Filter permissions..."
                          value={permissionFilter}
                          onChange={(event) => {
                            setPermissionFilter(event.target.value);
                          }}
                          disabled={permissionsLoading || !canAssignPermissions}
                        />
                        {permissionFilter && (
                          <button
                            type="button"
                            className="permission-search-clear"
                            onClick={() => setPermissionFilter("")}
                          >
                            <i className="fas fa-times" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="permission-container" id="rolePermissionsList">
                      {!canAssignPermissions ? (
                        <div className="permission-empty-state">
                          <i className="fas fa-lock" />
                          <p>You do not have permission to view or assign permissions.</p>
                        </div>
                      ) : permissionsLoading ? (
                        <div className="permission-empty-state">
                          <div className="permission-loader" />
                          <p>Loading permissions…</p>
                        </div>
                      ) : groupedPermissions.length === 0 ? (
                        <div className="permission-empty-state">
                          <i className="fas fa-search" />
                          <p>{permissionFilter ? "No permissions match your search." : "No permissions available."}</p>
                        </div>
                      ) : (
                        <div className="permission-groups-wrapper">
                          {groupedPermissions.map((group) => {
                            const isExpanded = expandedGroups.has(group.key) || !!permissionFilter;
                            const selectionState = getGroupSelectionState(group);
                            const groupTemplate = SIDEBAR_PERMISSION_GROUPS.find((t) => t.key === group.key);
                            const groupIcon = groupTemplate?.icon || "fas fa-folder";
                            const groupColor = groupTemplate?.color || "#6366f1";
                            const selectedInGroup = group.items.filter((item) => 
                              item.permissionId && selectedPermissionIds.has(item.permissionId)
                            ).length;

                            return (
                              <div className="permission-group-card" key={group.key}>
                                <div 
                                  className="permission-group-header"
                                  onClick={() => toggleGroupExpanded(group.key)}
                                  style={{ "--group-color": groupColor } as React.CSSProperties}
                                >
                                  <div className="permission-group-header-left">
                                    <div className="permission-group-icon" style={{ backgroundColor: `${groupColor}15`, color: groupColor }}>
                                      <i className={groupIcon} />
                                    </div>
                                    <div className="permission-group-info">
                                      <span className="permission-group-title">{group.title}</span>
                                      <span className="permission-group-count">
                                        {selectedInGroup} / {group.items.length} selected
                                      </span>
                                    </div>
                                  </div>
                                  <div className="permission-group-header-right">
                                    <button
                                      type="button"
                                      className={`permission-group-toggle-all ${selectionState}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAllGroupPermissions(group, selectionState !== "all");
                                      }}
                                      disabled={!canAssignPermissions}
                                      title={selectionState === "all" ? "Deselect all" : "Select all"}
                                    >
                                      <i className={selectionState === "all" ? "fas fa-check-square" : selectionState === "some" ? "fas fa-minus-square" : "far fa-square"} />
                                    </button>
                                    <i className={`permission-group-chevron fas fa-chevron-${isExpanded ? "up" : "down"}`} />
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="permission-group-content">
                                    {group.items.map((item) => {
                                      const checkboxId = `permission-${item.id}`;
                                      const permissionKey = item.permissionKey;
                                      const checked = item.permissionId
                                        ? selectedPermissionIds.has(item.permissionId)
                                        : false;
                                      const isLocked = item.permission
                                        ? isLockedPermission(item.permission)
                                        : false;
                                      const isMissingPermission = !item.permissionId;
                                      // Disable non-view permissions if view is not enabled
                                      const isNonViewPermission = !isViewPermission(item);
                                      const viewEnabled = isViewPermissionEnabled(group);
                                      const isDisabledDueToView = isNonViewPermission && !viewEnabled;
                                      return (
                                        <div className={`permission-item ${checked ? "selected" : ""} ${isLocked ? "locked" : ""} ${isMissingPermission ? "missing" : ""} ${isDisabledDueToView ? "view-required" : ""}`} key={item.id}>
                                          <label className="permission-toggle-wrapper" htmlFor={checkboxId}>
                                            <div className="permission-toggle">
                                              <input
                                                type="checkbox"
                                                className="permission-toggle-input"
                                                id={checkboxId}
                                                value={item.permissionId ?? item.id}
                                                checked={checked}
                                                onChange={(event) => {
                                                  togglePermissionSelection(
                                                    item.permissionId,
                                                    event.target.checked,
                                                    item.permission,
                                                    group,
                                                    item,
                                                  );
                                                }}
                                                disabled={saving || isLocked || !canAssignPermissions || isMissingPermission || isDisabledDueToView}
                                              />
                                              <span className="permission-toggle-track">
                                                <span className="permission-toggle-thumb" />
                                              </span>
                                            </div>
                                            <div className="permission-item-content">
                                              <span className="permission-item-label">
                                                {item.functionLabel}
                                                {isLocked && <span className="permission-locked-badge" title="Locked for this role"><i className="fas fa-lock" /></span>}
                                                {isDisabledDueToView && <span className="permission-view-required-badge" title="Enable View permission first"><i className="fas fa-eye-slash" /></span>}
                                              </span>
                                              {item.description && (
                                                <span className="permission-item-description">{item.description}</span>
                                              )}
                                              <span className="permission-item-key">
                                                <code>{permissionKey}</code>
                                                {isMissingPermission && <span className="permission-missing-badge">Not in backend</span>}
                                              </span>
                                            </div>
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer rbac-modal-footer">
                <button
                  type="button"
                  className="rbac-btn rbac-btn-cancel"
                  data-dismiss="modal"
                  onClick={closeModal}
                  disabled={saving}
                >
                  <i className="fas fa-times" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rbac-btn rbac-btn-save"
                  id="saveRoleBtn"
                  disabled={
                    saving ||
                    (modalMode === "create" ? !canCreateRole : !canUpdateRole)
                  }
                >
                  {saving ? (
                    <>
                      <i className="fas fa-spinner fa-spin" />
                      Saving...
                    </>
                  ) : modalMode === "edit" ? (
                    <>
                      <i className="fas fa-check" />
                      Update Role
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus" />
                      Create Role
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {modalOpen ? <div className="modal-backdrop fade show" /> : null}
      <style jsx>{`
        .rbac-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          padding: 1.75rem;
          border-radius: 18px;
          background: linear-gradient(135deg, #f7f9ff, #eef5ff);
          border: 1px solid #e3ebf7;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
        }

        .rbac-hero::after {
          content: "";
          position: absolute;
          top: -60px;
          right: -40px;
          width: 160px;
          height: 160px;
          background: radial-gradient(circle, rgba(64, 118, 255, 0.2), rgba(64, 118, 255, 0));
        }

        .rbac-hero-main h3 {
          margin-bottom: 0.5rem;
          font-weight: 800;
          font-size: 2rem;
          color: #0f172a;
        }

        .rbac-hero-main p {
          margin-bottom: 0;
          color: #1e293b;
          font-size: 1.25rem;
          font-weight: 500;
        }

        .rbac-kicker {
          display: inline-block;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 1.8px;
          font-weight: 700;
          color: #2f5bcb;
          margin-bottom: 0.5rem;
        }

        .rbac-hero-stats {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .rbac-stat {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e4eaf6;
          padding: 1.25rem 1.75rem;
          min-width: 140px;
          box-shadow: 0 8px 18px rgba(38, 73, 149, 0.08);
        }

        .rbac-stat-label {
          display: block;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #334155;
          font-weight: 700;
        }

        .rbac-stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: #0f172a;
        }

        .rbac-toolbar {
          gap: 1rem;
        }

        /* Toolbar Section */
        :global(.rbac-toolbar-section) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        :global(.rbac-toolbar-left) {
          display: flex;
          align-items: center;
        }

        :global(.rbac-section-title) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0;
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
        }

        :global(.rbac-section-title i) {
          color: #6366f1;
          font-size: 1.6rem;
        }

        :global(.rbac-toolbar-right) {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        :global(.rbac-search-wrapper) {
          position: relative;
          display: flex;
          align-items: center;
        }

        :global(.rbac-search-icon) {
          position: absolute;
          left: 1rem;
          color: #94a3b8;
          font-size: 1rem;
          pointer-events: none;
        }

        :global(.rbac-search-input) {
          padding: 0.75rem 2.5rem 0.75rem 2.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 1rem;
          width: 260px;
          transition: all 0.2s ease;
          background: #f8fafc;
        }

        :global(.rbac-search-input:focus) {
          outline: none;
          border-color: #6366f1;
          background: white;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        :global(.rbac-search-input::placeholder) {
          color: #94a3b8;
        }

        :global(.rbac-search-clear) {
          position: absolute;
          right: 0.5rem;
          background: #e2e8f0;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          font-size: 0.75rem;
          transition: all 0.15s ease;
        }

        :global(.rbac-search-clear:hover) {
          background: #cbd5e1;
          color: #475569;
        }

        :global(.rbac-create-btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }

        :global(.rbac-create-btn:hover) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        :global(.rbac-create-btn:active) {
          transform: translateY(0);
        }

        :global(.rbac-create-btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        :global(.rbac-create-btn i) {
          font-size: 0.9rem;
        }

        :global(.rbac-sync-btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        :global(.rbac-sync-btn:hover) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        :global(.rbac-sync-btn:active) {
          transform: translateY(0);
        }

        :global(.rbac-sync-btn:disabled) {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        :global(.rbac-sync-btn i) {
          font-size: 0.9rem;
        }

        :global(.rbac-table thead th) {
          background: #f3f6fb;
          border-bottom: 1px solid #e6edf7;
          color: #0f172a;
          font-weight: 700;
          font-size: 1.15rem;
          padding: 1.25rem 1.5rem;
        }

        :global(.rbac-table tbody tr:hover) {
          background: #f7fbff;
        }

        :global(.rbac-table tbody td) {
          font-size: 1.15rem;
          color: #0f172a;
          padding: 1.25rem 1.5rem;
          vertical-align: middle;
        }

        :global(.rbac-modal) {
          border-radius: 18px;
          overflow: hidden;
        }

        :global(.rbac-modal .modal-header) {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-bottom: none;
          padding: 1.25rem 1.5rem;
        }

        :global(.rbac-modal .modal-header .modal-title) {
          font-weight: 600;
        }

        :global(.rbac-modal .modal-header .close) {
          color: white;
          opacity: 0.8;
          text-shadow: none;
        }

        :global(.rbac-modal .modal-header .close:hover) {
          opacity: 1;
        }

        :global(.rbac-modal .modal-body) {
          padding: 1.5rem;
        }

        :global(.rbac-modal .modal-footer) {
          border-top: 1px solid #e5e7eb;
          padding: 1rem 1.5rem;
          background: #f9fafb;
        }

        /* Modal Footer Buttons */
        :global(.rbac-modal-footer) {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        :global(.rbac-btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        :global(.rbac-btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.rbac-btn-cancel) {
          background: #f1f5f9;
          color: #475569;
        }

        :global(.rbac-btn-cancel:hover:not(:disabled)) {
          background: #e2e8f0;
        }

        :global(.rbac-btn-save) {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }

        :global(.rbac-btn-save:hover:not(:disabled)) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        /* Permission Section Header */
        :global(.permission-section-header) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        :global(.permission-section-title) {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-weight: 800;
          color: #0f172a;
          font-size: 1.5rem;
        }

        :global(.permission-section-title i) {
          color: #6366f1;
          font-size: 1.35rem;
        }

        :global(.permission-badge-count) {
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          color: #3730a3;
          padding: 0.5rem 1.25rem;
          border-radius: 12px;
          font-size: 1.15rem;
          font-weight: 700;
        }

        :global(.permission-search-wrapper) {
          position: relative;
          display: flex;
          align-items: center;
        }

        :global(.permission-search-icon) {
          position: absolute;
          left: 0.875rem;
          color: #94a3b8;
          font-size: 0.9rem;
          pointer-events: none;
        }

        :global(.permission-search-input) {
          padding: 0.625rem 2.25rem 0.625rem 2.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
          width: 220px;
          transition: all 0.2s ease;
          background: white;
        }

        :global(.permission-search-input:focus) {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        :global(.permission-search-input::placeholder) {
          color: #94a3b8;
        }

        :global(.permission-search-input:disabled) {
          background: #f8fafc;
          cursor: not-allowed;
        }

        :global(.permission-search-clear) {
          position: absolute;
          right: 0.5rem;
          background: #e2e8f0;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          font-size: 0.75rem;
          transition: all 0.15s ease;
        }

        :global(.permission-search-clear:hover) {
          background: #cbd5e1;
          color: #475569;
        }

        /* Permission Container */
        :global(.permission-container) {
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          max-height: 500px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        :global(.permission-container::-webkit-scrollbar) {
          width: 6px;
        }

        :global(.permission-container::-webkit-scrollbar-track) {
          background: transparent;
        }

        :global(.permission-container::-webkit-scrollbar-thumb) {
          background-color: #cbd5e1;
          border-radius: 3px;
        }

        /* Permission Empty State */
        :global(.permission-empty-state) {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          color: #64748b;
        }

        :global(.permission-empty-state i) {
          font-size: 3rem;
          margin-bottom: 1.25rem;
          opacity: 0.5;
        }

        :global(.permission-empty-state p) {
          margin: 0;
          font-size: 1.1rem;
        }

        :global(.permission-loader) {
          width: 48px;
          height: 48px;
          border: 3px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1.25rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Permission Groups */
        :global(.permission-groups-wrapper) {
          padding: 0.75rem;
        }

        :global(.permission-group-card) {
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }

        :global(.permission-group-card:hover) {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        :global(.permission-group-header) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          cursor: pointer;
          user-select: none;
          background: linear-gradient(to right, rgba(var(--group-color-rgb, 99, 102, 241), 0.04), transparent);
          border-left: 4px solid var(--group-color, #6366f1);
          transition: background 0.2s ease;
        }

        :global(.permission-group-header:hover) {
          background: linear-gradient(to right, rgba(var(--group-color-rgb, 99, 102, 241), 0.08), transparent);
        }

        :global(.permission-group-header-left) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        :global(.permission-group-icon) {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        :global(.permission-group-info) {
          display: flex;
          flex-direction: column;
        }

        :global(.permission-group-title) {
          font-weight: 800;
          font-size: 1.4rem;
          color: #0f172a;
        }

        :global(.permission-group-count) {
          font-size: 1.1rem;
          color: #334155;
          font-weight: 600;
        }

        :global(.permission-group-header-right) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        :global(.permission-group-toggle-all) {
          background: none;
          border: none;
          padding: 0.375rem;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s ease;
          font-size: 1.1rem;
        }

        :global(.permission-group-toggle-all:hover) {
          color: #6366f1;
          background: #eef2ff;
        }

        :global(.permission-group-toggle-all.all) {
          color: #22c55e;
        }

        :global(.permission-group-toggle-all.some) {
          color: #f59e0b;
        }

        :global(.permission-group-chevron) {
          color: #94a3b8;
          font-size: 0.9rem;
          transition: transform 0.2s ease;
        }

        /* Permission Group Content */
        :global(.permission-group-content) {
          border-top: 1px solid #f1f5f9;
          padding: 0.75rem;
          display: grid;
          gap: 0.5rem;
        }

        /* Individual Permission Items */
        :global(.permission-item) {
          background: #f8fafc;
          border-radius: 10px;
          padding: 1.25rem 1.5rem;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }

        :global(.permission-item:hover) {
          background: #f1f5f9;
        }

        :global(.permission-item.selected) {
          background: #eef2ff;
          border-color: #a5b4fc;
        }

        :global(.permission-item.locked) {
          opacity: 0.75;
        }

        :global(.permission-item.missing) {
          opacity: 0.6;
          background: #fef2f2;
        }

        :global(.permission-toggle-wrapper) {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          cursor: pointer;
          margin: 0;
        }

        /* Toggle Switch Styling */
        :global(.permission-toggle) {
          position: relative;
          flex-shrink: 0;
          margin-top: 2px;
        }

        :global(.permission-toggle-input) {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        :global(.permission-toggle-track) {
          display: block;
          width: 64px;
          height: 36px;
          background: #94a3b8;
          border-radius: 18px;
          transition: all 0.2s ease;
          position: relative;
        }

        :global(.permission-toggle-input:checked + .permission-toggle-track) {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }

        :global(.permission-toggle-input:focus + .permission-toggle-track) {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        :global(.permission-toggle-input:disabled + .permission-toggle-track) {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.permission-toggle-thumb) {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 30px;
          height: 30px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        }

        :global(.permission-toggle-input:checked + .permission-toggle-track .permission-toggle-thumb) {
          transform: translateX(28px);
        }

        /* Permission Item Content */
        :global(.permission-item-content) {
          flex: 1;
          min-width: 0;
        }

        :global(.permission-item-label) {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 800;
          font-size: 1.35rem;
          color: #0f172a;
          margin-bottom: 0.4rem;
        }

        :global(.permission-locked-badge) {
          color: #f59e0b;
          font-size: 1.1rem;
        }

        :global(.permission-view-required-badge) {
          color: #94a3b8;
          font-size: 1rem;
          margin-left: 0.25rem;
        }

        :global(.permission-item.view-required) {
          opacity: 0.5;
          background: #f1f5f9;
        }

        :global(.permission-item.view-required .permission-toggle-track) {
          background: #cbd5e1 !important;
          cursor: not-allowed;
        }

        :global(.permission-item-description) {
          display: block;
          font-size: 1.15rem;
          color: #1e293b;
          margin-bottom: 0.5rem;
          line-height: 1.5;
          font-weight: 500;
        }

        :global(.permission-item-key) {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        :global(.permission-item-key code) {
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
          font-size: 1.05rem;
          background: #e2e8f0;
          padding: 0.3rem 0.75rem;
          border-radius: 6px;
          color: #0f172a;
          font-weight: 600;
        }

        :global(.permission-missing-badge) {
          font-size: 0.8rem;
          background: #fee2e2;
          color: #dc2626;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 500;
        }

        /* Table Loading State */
        :global(.table-loader) {
          width: 24px;
          height: 24px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Role Table Enhancements */
        :global(.rbac-table) {
          border-collapse: separate;
          border-spacing: 0;
        }

        :global(.rbac-table thead th) {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
          border-bottom: 2px solid #e2e8f0;
          color: #475569;
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 1rem 1.25rem;
        }

        :global(.rbac-table tbody tr) {
          transition: all 0.15s ease;
        }

        :global(.rbac-table tbody tr:hover) {
          background: #f8fafc;
        }

        :global(.rbac-table tbody tr.system-role-row) {
          background: #fefce8;
        }

        :global(.rbac-table tbody tr.system-role-row:hover) {
          background: #fef9c3;
        }

        :global(.rbac-table tbody td) {
          padding: 1.125rem 1.25rem;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
          font-size: 1rem;
        }

        :global(.role-name-cell) {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        :global(.role-name) {
          font-weight: 700;
          color: #0f172a;
          font-size: 1.25rem;
        }

        :global(.role-system-badge) {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #ca8a04;
          background: #fef3c7;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          width: fit-content;
        }

        :global(.role-description) {
          color: #334155;
          font-size: 1.1rem;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.permission-count-badge) {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          color: #3730a3;
          padding: 0.6rem 1.25rem;
          border-radius: 20px;
          font-size: 1.1rem;
          font-weight: 600;
        }

        :global(.permission-count-badge i) {
          font-size: 1rem;
        }

        :global(.role-updated) {
          color: #334155;
          font-size: 1.05rem;
        }

        :global(.role-locked-indicator) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #fef3c7;
          color: #ca8a04;
          border-radius: 8px;
          font-size: 0.85rem;
        }

        :global(.role-action-buttons) {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        :global(.role-action-btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.8rem;
        }

        :global(.role-action-btn.edit) {
          background: #eef2ff;
          color: #4f46e5;
        }

        :global(.role-action-btn.edit:hover) {
          background: #4f46e5;
          color: white;
        }

        :global(.role-action-btn.delete) {
          background: #fef2f2;
          color: #dc2626;
        }

        :global(.role-action-btn.delete:hover) {
          background: #dc2626;
          color: white;
        }

        :global(.role-action-btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .rbac-hero {
            flex-direction: column;
            align-items: flex-start;
          }

          :global(.permission-group-content) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
