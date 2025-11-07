"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

type FeedbackType = "success" | "danger";

interface FeedbackState {
  type: FeedbackType;
  message: string;
}

interface PermissionGroupItem {
  id: string;
  permission: Permission;
  displayName: string;
}

interface PermissionGroup {
  key: string;
  title: string;
  items: PermissionGroupItem[];
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

const formatPermissionName = (permissionName: string): {
  groupKey: string;
  groupTitle: string;
  displayName: string;
} => {
  const rawParts = permissionName.split(".");
  const groupPart = rawParts.length > 1 ? rawParts[0] : "general";
  const remaining = rawParts.length > 1 ? rawParts.slice(1) : rawParts;
  const display = remaining.join(" ").replace(/[-_.]/g, " ").trim();
  return {
    groupKey: groupPart || "general",
    groupTitle: (groupPart || "general").replace(/[-_]/g, " "),
    displayName: display || permissionName.replace(/[-_.]/g, " "),
  };
};

const collectPermissionGroups = (
  permissions: Permission[],
  filterTerm: string,
): PermissionGroup[] => {
  const term = filterTerm.trim().toLowerCase();
  const grouped = new Map<string, PermissionGroup>();

  permissions.forEach((permission) => {
    const name = String(permission?.name ?? "");
    const description = String(permission?.description ?? "");

    if (term) {
      const matches =
        name.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term);
      if (!matches) {
        return;
      }
    }

    const { groupKey, groupTitle, displayName } = formatPermissionName(name);
    const entry =
      grouped.get(groupKey) ??
      {
        key: groupKey,
        title: groupTitle,
        items: [] as PermissionGroupItem[],
      };

    entry.items.push({
      id: String(permission.id),
      permission,
      displayName,
    });

    grouped.set(groupKey, entry);
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      title: group.title,
      items: group.items.sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
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

export default function RolesPage() {
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
  const [deletingRoleId, setDeletingRoleId] = useState<number | string | null>(
    null,
  );

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
    setPermissionsLoading(true);
    try {
      const response = await listPermissions({
        per_page: 200,
      });
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
  }, [showFeedback]);

  const loadRoles = useCallback(async () => {
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
  }, [showFeedback]);

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

  const groupedPermissions = useMemo<PermissionGroup[]>(() => {
    if (permissionsLoading) {
      return [];
    }
    return collectPermissionGroups(permissions, permissionFilter);
  }, [permissionFilter, permissions, permissionsLoading]);

  const selectedPermissionsCount = selectedPermissionIds.size;

  const openCreateModal = () => {
    setModalMode("create");
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissionIds(new Set());
    setPermissionFilter("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (role: Role) => {
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRole(null);
    setSaving(false);
    setFormError(null);
  };

  const togglePermissionSelection = (permissionId: string, checked: boolean) => {
    setSelectedPermissionIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
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

    setSaving(true);
    setFormError(null);
    try {
      const permissionsPayload = Array.from(selectedPermissionIds).map(
        (value) => {
          const numeric = Number(value);
          return Number.isNaN(numeric) ? value : numeric;
        },
      );

      if (modalMode === "edit" && editingRole) {
        await updateRole(editingRole.id, {
          name: trimmedName,
          description: trimmedDescription || null,
          permissions: permissionsPayload,
        });
        showFeedback("Role updated successfully.", "success");
      } else {
        await createRole({
          name: trimmedName,
          description: trimmedDescription || null,
          permissions: permissionsPayload,
        });
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
          <div className="heading-layout1 mb-3">
            <div className="item-title">
              <h3>Roles</h3>
            </div>
            <div className="d-flex flex-column flex-md-row align-items-md-center">
              <input
                type="text"
                className="form-control form-control-sm mr-md-2 mb-2 mb-md-0"
                id="roleSearch"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                }}
              />
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                id="addRoleBtn"
                onClick={openCreateModal}
              >
                <i className="fas fa-plus mr-2" />
                Create Role
              </button>
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

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableMessage ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={`text-center ${
                        rolesLoading ? "" : "text-muted"
                      }`}
                    >
                      {tableMessage}
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr key={String(role.id)}>
                      <td>{role.name}</td>
                      <td>{role.description || "—"}</td>
                      <td>{summarizeRolePermissions(role)}</td>
                      <td>{formatDateTime(role.updated_at)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary mr-1"
                          onClick={() => {
                            openEditModal(role);
                          }}
                        >
                          <i className="fas fa-edit" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            void handleDeleteRole(role);
                          }}
                          disabled={deletingRoleId === role.id}
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))
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
        aria-hidden={!modalOpen}
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
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
                    <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between mb-2">
                      <label className="mb-2 mb-lg-0 font-weight-medium">
                        Permissions
                      </label>
                      <div className="w-100 w-lg-50">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          id="permissionSearch"
                          placeholder="Filter permissions..."
                          value={permissionFilter}
                          onChange={(event) => {
                            setPermissionFilter(event.target.value);
                          }}
                          disabled={permissionsLoading}
                        />
                      </div>
                    </div>
                    <div className="border rounded p-3 permission-list" id="rolePermissionsList">
                      {permissionsLoading ? (
                        <p className="text-muted mb-0">Loading permissions…</p>
                      ) : groupedPermissions.length === 0 ? (
                        <p className="text-muted mb-0">
                          {permissionFilter
                            ? "No permissions match your search."
                            : "No permissions available."}
                        </p>
                      ) : (
                        groupedPermissions.map((group) => (
                          <div className="permission-group mb-3" key={group.key}>
                            <h6 className="text-uppercase text-muted small mb-2">
                              {group.title}
                            </h6>
                            <div className="row">
                              {group.items.map((item) => {
                                const checkboxId = `permission-${item.id}`;
                                const checked = selectedPermissionIds.has(
                                  item.id,
                                );
                                return (
                                  <div
                                    className="col-sm-6 col-lg-4 mb-2"
                                    key={item.id}
                                  >
                                    <div className="custom-control custom-switch">
                                      <input
                                        type="checkbox"
                                        className="custom-control-input permission-checkbox"
                                        id={checkboxId}
                                        value={item.id}
                                        checked={checked}
                                        onChange={(event) => {
                                          togglePermissionSelection(
                                            item.id,
                                            event.target.checked,
                                          );
                                        }}
                                        disabled={saving}
                                      />
                                      <label
                                        className="custom-control-label"
                                        htmlFor={checkboxId}
                                      >
                                        {item.displayName}
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <small className="form-text text-muted">
                      Selected <span id="rolePermissionsCount">{selectedPermissionsCount}</span>{" "}
                      permission(s).
                    </small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                  data-dismiss="modal"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  id="saveRoleBtn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : modalMode === "edit"
                      ? "Update Role"
                      : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {modalOpen ? <div className="modal-backdrop fade show" /> : null}
    </>
  );
}
