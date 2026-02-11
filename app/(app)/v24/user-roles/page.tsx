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
import { listRoles, type Role } from "@/lib/roles";
import {
  listUsers,
  updateUserRoles,
  type ManagedUser,
} from "@/lib/users";

type FeedbackType = "success" | "danger";

interface FeedbackState {
  type: FeedbackType;
  message: string;
}

const buildRoleSummary = (user: ManagedUser): ReactNode => {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.length) {
    return <span className="badge badge-secondary">No roles</span>;
  }
  const summary = roles
    .map((role) => (typeof role?.name === "string" ? role.name : ""))
    .filter((name) => name.trim().length > 0)
    .join(", ");
  if (!summary) {
    return <span className="badge badge-secondary">No roles</span>;
  }
  return <>{summary}</>;
};

const filterRolesByTerm = (roles: Role[], term: string): Role[] => {
  if (!term) {
    return roles;
  }
  const normalized = term.toLowerCase();
  return roles.filter((role) => {
    const name = String(role?.name ?? "").toLowerCase();
    const description = String(role?.description ?? "").toLowerCase();
    return name.includes(normalized) || description.includes(normalized);
  });
};

const SYSTEM_ROLE_NAMES = new Set(["admin", "super_admin"]);

const userHasAdminRole = (user: ManagedUser | null): boolean => {
  if (!user) {
    return false;
  }
  const directRole =
    typeof (user as { role?: unknown }).role === "string"
      ? (user as { role?: string }).role?.toLowerCase()
      : "";
  if (directRole === "admin") {
    return true;
  }
  if (!Array.isArray(user.roles)) {
    return false;
  }
  return user.roles.some((role) => {
    const roleName =
      typeof role?.name === "string" ? role.name.toLowerCase() : "";
    return roleName === "admin";
  });
};

export default function UserRolesPage() {
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
  const canViewUserRoles = isAdmin || hasPermission("user-roles.view");
  const canAssignUserRoles = isAdmin || hasPermission("user-roles.assign");
  const canRemoveUserRoles = isAdmin || hasPermission("user-roles.remove");
  const canEditUserRoles = canAssignUserRoles || canRemoveUserRoles;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showFeedback = useCallback(
    (message: string, type: FeedbackType) => {
      setFeedback({ message, type });
    },
    [],
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const loadRoles = useCallback(async () => {
    if (!canViewUserRoles) {
      setLoadingRoles(false);
      setRoles([]);
      return;
    }
    setLoadingRoles(true);
    try {
      const response = await listRoles({ per_page: 200 });
      setRoles(response.data ?? []);
    } catch (error) {
      console.error("Unable to load roles", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load roles. Please try again.",
        "danger",
      );
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, [canViewUserRoles, showFeedback]);

  const loadUsers = useCallback(
    async (
      pageOverride: number | null = null,
      searchOverride: string | null = null,
      perPageOverride: number | null = null,
    ) => {
      const page = pageOverride ?? currentPage;
      const perPageValue = perPageOverride ?? perPage;
      const searchValue = searchOverride ?? searchTerm;

      if (!canViewUserRoles) {
        setLoadingUsers(false);
        setUsers([]);
        setTotalUsers(0);
        setLastPage(1);
        setUsersError("You do not have permission to view user roles.");
        return;
      }
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const response = await listUsers({
          page,
          per_page: perPageValue,
          search: searchValue ? searchValue.trim() : undefined,
          support_only: true,
        });

        setUsers(response.data ?? []);
        setCurrentPage(response.current_page ?? page);
        setPerPage(response.per_page ?? perPageValue);
        setTotalUsers(response.total ?? response.data?.length ?? 0);
        setLastPage(response.last_page ?? 1);
      } catch (error) {
        console.error("Unable to load users", error);
        showFeedback(
          error instanceof Error
            ? error.message
            : "Unable to load users. Please try again.",
          "danger",
        );
        setUsers([]);
        setTotalUsers(0);
        setLastPage(1);
        setUsersError(
          error instanceof Error
            ? error.message
            : "Unable to load users. Please try again.",
        );
      } finally {
        setLoadingUsers(false);
      }
    },
    [canViewUserRoles, currentPage, perPage, searchTerm, showFeedback],
  );

  useEffect(() => {
    void loadRoles();
    void loadUsers();
  }, [loadRoles, loadUsers]);

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

  const filteredRoles = useMemo(
    () => filterRolesByTerm(roles, roleFilter),
    [roles, roleFilter],
  );

  const selectedRolesCount = selectedRoleIds.size;
  const roleChangeNote = !canEditUserRoles
    ? "You do not have permission to assign or remove roles."
    : !canAssignUserRoles
      ? "You can only remove roles from this user."
      : !canRemoveUserRoles
        ? "You can only assign roles to this user."
        : null;

  const handleOpenModal = (user: ManagedUser) => {
    if (!canEditUserRoles) {
      return;
    }
    if (userHasAdminRole(user)) {
      return;
    }
    setSelectedUser(user);
    const ids = new Set<string>();
    if (Array.isArray(user.roles)) {
      user.roles.forEach((role) => {
        if (role?.id !== undefined && role?.id !== null) {
          ids.add(String(role.id));
        }
      });
    }
    setSelectedRoleIds(ids);
    setRoleFilter("");
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
    setSelectedRoleIds(new Set());
    setModalError(null);
    setSaving(false);
  };

  const userHasTeacherRole = useCallback((): boolean => {
    if (!selectedUser || !Array.isArray(selectedUser.roles)) {
      return false;
    }
    return selectedUser.roles.some((role) => {
      const roleName = typeof role?.name === "string" ? role.name.toLowerCase() : "";
      return roleName === "teacher";
    });
  }, [selectedUser]);

  const isTeacherRole = useCallback((role: Role): boolean => {
    const roleName = typeof role?.name === "string" ? role.name.toLowerCase() : "";
    return roleName === "teacher";
  }, []);

  const toggleRoleSelection = (roleId: string, checked: boolean, role?: Role) => {
    if (checked && !canAssignUserRoles) {
      return;
    }
    if (!checked && !canRemoveUserRoles) {
      return;
    }
    // Prevent unchecking teacher role if user has it
    if (!checked && role && isTeacherRole(role) && userHasTeacherRole()) {
      return;
    }
    setSelectedRoleIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) {
      setModalError("No user is selected.");
      return;
    }
    if (!canEditUserRoles) {
      setModalError("You do not have permission to update user roles.");
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      const roleIds = Array.from(selectedRoleIds);
      await updateUserRoles(selectedUser.id, roleIds);
      showFeedback("User roles updated successfully.", "success");
      closeModal();
      await loadUsers(currentPage, searchTerm, perPage);
    } catch (error) {
      console.error("Unable to update user roles", error);
      setModalError(
        error instanceof Error
          ? error.message
          : "Unable to update user roles. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePerPage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const parsed = parseInt(event.target.value, 10);
    const value = Number.isNaN(parsed) ? 25 : parsed;
    setPerPage(value);
    setCurrentPage(1);
    void loadUsers(1, searchTerm, value);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    void loadUsers(1, value, perPage);
  };

  const handleChangePage = (page: number) => {
    if (page === currentPage || page < 1 || page > lastPage) {
      return;
    }
    setCurrentPage(page);
    void loadUsers(page, searchTerm, perPage);
  };

  const paginationItems = useMemo(() => {
    if (lastPage <= 1) {
      return [];
    }
    const items: Array<{
      key: string;
      label: string;
      page: number | null;
      disabled?: boolean;
      active?: boolean;
      isEllipsis?: boolean;
    }> = [];

    const addPage = (
      page: number,
      label: string,
      options: { disabled?: boolean; active?: boolean } = {},
    ) => {
      items.push({
        key: label,
        label,
        page,
        disabled: options.disabled,
        active: options.active,
      });
    };

    addPage(currentPage - 1, "Previous", {
      disabled: currentPage === 1,
    });

    let leftEllipsisAdded = false;
    let rightEllipsisAdded = false;

    for (let page = 1; page <= lastPage; page += 1) {
      const isBoundary = page === 1 || page === lastPage;
      const isNearCurrent = Math.abs(page - currentPage) <= 1;

      if (isBoundary || isNearCurrent) {
        addPage(page, String(page), {
          active: page === currentPage,
        });
      } else if (page < currentPage && !leftEllipsisAdded) {
        items.push({
          key: `ellipsis-left-${page}`,
          label: "…",
          page: null,
          disabled: true,
          isEllipsis: true,
        });
        leftEllipsisAdded = true;
      } else if (page > currentPage && !rightEllipsisAdded) {
        items.push({
          key: `ellipsis-right-${page}`,
          label: "…",
          page: null,
          disabled: true,
          isEllipsis: true,
        });
        rightEllipsisAdded = true;
      }
    }

    addPage(currentPage + 1, "Next", {
      disabled: currentPage === lastPage,
    });

    return items;
  }, [currentPage, lastPage]);

  const tableMessage = useMemo(() => {
    if (loadingUsers) {
      return "Loading users...";
    }
    if (usersError) {
      return usersError;
    }
    if (!users.length) {
      return searchTerm ? "No users match your search." : "No users found.";
    }
    return null;
  }, [loadingUsers, searchTerm, users.length, usersError]);

  const pageStart = users.length
    ? (currentPage - 1) * perPage + 1
    : 0;
  const pageEnd = users.length
    ? (currentPage - 1) * perPage + users.length
    : 0;
  const totalRolesCount = roles.length;
  const visibleUsersCount = users.length;

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>User Role Assignment</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>RBAC</li>
          <li>Users</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="rbac-hero">
            <div className="rbac-hero-main">
              <span className="rbac-kicker">Role assignments</span>
              <h3>User Roles</h3>
              <p>
                Match users to roles and keep access aligned with responsibilities.
              </p>
            </div>
            <div className="rbac-hero-stats">
              <div className="rbac-stat">
                <span className="rbac-stat-label">Users</span>
                <span className="rbac-stat-value">{totalUsers}</span>
              </div>
              <div className="rbac-stat">
                <span className="rbac-stat-label">Visible</span>
                <span className="rbac-stat-value">{visibleUsersCount}</span>
              </div>
              <div className="rbac-stat">
                <span className="rbac-stat-label">Roles</span>
                <span className="rbac-stat-value">{totalRolesCount}</span>
              </div>
            </div>
          </div>

          <div className="heading-layout1 mb-3 rbac-toolbar">
            <div className="item-title">
              <h3>Users</h3>
            </div>
            <div className="d-flex flex-column flex-sm-row align-items-sm-center">
              <input
                type="text"
                className="form-control form-control-sm mr-sm-2 mb-2 mb-sm-0"
                id="userSearch"
                placeholder="Search users..."
                value={searchTerm}
                onChange={handleSearchChange}
                disabled={!canViewUserRoles}
              />
              <select
                className="form-control form-control-sm mr-sm-2 mb-2 mb-sm-0"
                id="pageSizeSelect"
                value={perPage}
                onChange={handleChangePerPage}
                disabled={!canViewUserRoles}
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                id="refreshUsersBtn"
                onClick={() => {
                  void loadUsers();
                }}
                disabled={loadingUsers || !canViewUserRoles}
              >
                <i className="fas fa-sync-alt mr-1" />
                Refresh
              </button>
            </div>
          </div>

          <div id="userRolesAlert">
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
          {!canViewUserRoles ? (
            <div className="alert alert-warning" role="alert">
              You do not have permission to view user roles.
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap rbac-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Roles</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableMessage ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      {tableMessage}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name || "—"}</td>
                      <td>{user.email || "—"}</td>
                      <td>{buildRoleSummary(user)}</td>
                      <td className="text-right">
                        {userHasAdminRole(user) ? (
                          <span
                            className="badge badge-light text-muted"
                            title="Admin account cannot be modified"
                          >
                            Locked
                          </span>
                        ) : canEditUserRoles ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              handleOpenModal(user);
                            }}
                          >
                            <i className="fas fa-user-shield mr-1" />
                            Assign Roles
                          </button>
                        ) : (
                          <span className="text-muted">No access</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mt-3">
            <div className="text-muted mb-2 mb-md-0">
              {usersError
                ? usersError
                : totalUsers
                  ? `Showing ${pageStart}-${pageEnd} of ${totalUsers} user${
                      totalUsers === 1 ? "" : "s"
                    }`
                  : "No users to display."}
            </div>
            <nav aria-label="User pagination">
              <ul className="pagination justify-content-end mb-0" id="usersPagination">
                {paginationItems.map((item) => (
                  <li
                    key={item.key}
                    className={`page-item ${
                      item.disabled || !canViewUserRoles ? "disabled" : ""
                    } ${item.active ? "active" : ""}`}
                  >
                    {item.isEllipsis ? (
                      <span className="page-link">{item.label}</span>
                    ) : (
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => {
                          if (item.page !== null) {
                            handleChangePage(item.page);
                          }
                        }}
                        disabled={item.disabled || !canViewUserRoles}
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
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
              <h5 className="modal-title" id="userRoleModalTitle">
                Assign Roles
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
            <form id="userRoleForm" onSubmit={handleSubmit}>
              <div className="modal-body">
                {selectedUser ? (
                  <div className="mb-3">
                    <h6 id="userSummary" className="mb-0 text-primary">
                      {selectedUser.name || "—"}
                    </h6>
                    <small className="text-muted" id="userEmailSummary">
                      {selectedUser.email || ""}
                    </small>
                  </div>
                ) : null}

                {modalError ? (
                  <div className="alert alert-danger" role="alert">
                    {modalError}
                  </div>
                ) : null}
                {roleChangeNote ? (
                  <div className="alert alert-warning py-2" role="alert">
                    {roleChangeNote}
                  </div>
                ) : null}

                <div className="form-group">
                  <label htmlFor="roleFilter">Available Roles</label>
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    id="roleFilter"
                    placeholder="Filter roles..."
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value);
                    }}
                    disabled={loadingRoles || !canEditUserRoles}
                  />
                  <div className="border rounded p-3" id="rolesCheckboxList">
                    {loadingRoles ? (
                      <p className="text-muted mb-0">Loading roles…</p>
                    ) : filteredRoles.length === 0 ? (
                      <p className="text-muted mb-0">
                        {roleFilter
                          ? "No roles match your search."
                          : "No roles available."}
                      </p>
                    ) : (
                      filteredRoles
                        .slice()
                        .sort((a, b) =>
                          String(a.name || "").localeCompare(
                            String(b.name || ""),
                          ),
                        )
                        .filter((role) => {
                          const n = String(role?.name || "").toLowerCase();
                          return !SYSTEM_ROLE_NAMES.has(n);
                        })
                        .map((role) => {
                          const checkboxId = `assign-role-${role.id}`;
                          const roleId = String(role.id);
                          const checked = selectedRoleIds.has(roleId);
                          const isTeacher = isTeacherRole(role);
                          const hasTeacherRole = userHasTeacherRole();
                          const isLocked = isTeacher && hasTeacherRole;
                          const disableToggle = checked
                            ? !canRemoveUserRoles
                            : !canAssignUserRoles;
                          return (
                            <div
                              className="custom-control custom-checkbox mb-2"
                              key={roleId}
                            >
                              <input
                                type="checkbox"
                                className="custom-control-input user-role-checkbox"
                                id={checkboxId}
                                value={roleId}
                                checked={checked}
                                onChange={(event) => {
                                  toggleRoleSelection(
                                    roleId,
                                    event.target.checked,
                                    role,
                                  );
                                }}
                                disabled={saving || loadingRoles || isLocked || disableToggle}
                                title={
                                  isLocked
                                    ? "Teacher role cannot be removed from this user"
                                    : disableToggle && !checked
                                      ? "You do not have permission to assign roles"
                                      : disableToggle && checked
                                        ? "You do not have permission to remove roles"
                                        : undefined
                                }
                              />
                              <label
                                className="custom-control-label"
                                htmlFor={checkboxId}
                              >
                                {role.name || ""}
                                {isLocked ? (
                                  <small className="text-muted ml-1" title="Locked - cannot be removed">
                                    🔒
                                  </small>
                                ) : null}
                                {role.description ? (
                                  <small className="d-block text-muted">
                                    {role.description}
                                  </small>
                                ) : null}
                              </label>
                            </div>
                          );
                        })
                    )}
                  </div>
                  <small className="form-text text-muted">
                    Selected <span id="selectedRolesCount">{selectedRolesCount}</span> role(s).
                  </small>
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
                  disabled={saving || loadingRoles || !canEditUserRoles}
                >
                  {saving ? "Saving..." : "Save Changes"}
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
          background: linear-gradient(135deg, #fff7ed, #f2f7ff);
          border: 1px solid #f0e4d6;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
        }

        .rbac-hero::after {
          content: "";
          position: absolute;
          bottom: -70px;
          right: -40px;
          width: 180px;
          height: 180px;
          background: radial-gradient(circle, rgba(255, 167, 38, 0.18), rgba(255, 167, 38, 0));
        }

        .rbac-hero-main h3 {
          margin-bottom: 0.35rem;
          font-weight: 700;
        }

        .rbac-hero-main p {
          margin-bottom: 0;
          color: #5a5f66;
        }

        .rbac-kicker {
          display: inline-block;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1.6px;
          font-weight: 700;
          color: #d97706;
          margin-bottom: 0.4rem;
        }

        .rbac-hero-stats {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .rbac-stat {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #f1e8db;
          padding: 0.6rem 0.9rem;
          min-width: 110px;
          box-shadow: 0 8px 18px rgba(138, 93, 14, 0.08);
        }

        .rbac-stat-label {
          display: block;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9a7a57;
        }

        .rbac-stat-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .rbac-toolbar {
          gap: 1rem;
        }

        :global(.rbac-table thead th) {
          background: #fbf7f2;
          border-bottom: 1px solid #f0e6da;
          color: #6b5d4a;
          font-weight: 600;
        }

        :global(.rbac-table tbody tr:hover) {
          background: #fff7ed;
        }

        :global(.rbac-modal) {
          border-radius: 18px;
        }

        @media (max-width: 768px) {
          .rbac-hero {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}
