"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

// All users are editable; no protected system users.

export default function UserRolesPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

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
  }, [showFeedback]);

  const loadUsers = useCallback(
    async (
      pageOverride: number | null = null,
      searchOverride: string | null = null,
      perPageOverride: number | null = null,
    ) => {
      const page = pageOverride ?? currentPage;
      const perPageValue = perPageOverride ?? perPage;
      const searchValue = searchOverride ?? searchTerm;

      setLoadingUsers(true);
      try {
        const response = await listUsers({
          page,
          per_page: perPageValue,
          search: searchValue ? searchValue.trim() : undefined,
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
      } finally {
        setLoadingUsers(false);
      }
    },
    [currentPage, perPage, searchTerm, showFeedback],
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

  const handleOpenModal = (user: ManagedUser) => {
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

  const toggleRoleSelection = (roleId: string, checked: boolean) => {
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

  const pageStart = users.length
    ? (currentPage - 1) * perPage + 1
    : 0;
  const pageEnd = users.length
    ? (currentPage - 1) * perPage + users.length
    : 0;

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
          <div className="heading-layout1 mb-3">
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
              />
              <select
                className="form-control form-control-sm mr-sm-2 mb-2 mb-sm-0"
                id="pageSizeSelect"
                value={perPage}
                onChange={handleChangePerPage}
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
                disabled={loadingUsers}
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

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Roles</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name || "—"}</td>
                      <td>{user.email || "—"}</td>
                      <td>{buildRoleSummary(user)}</td>
                      <td className="text-right">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mt-3">
            <div className="text-muted mb-2 mb-md-0">
              {totalUsers
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
                      item.disabled ? "disabled" : ""
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
                        disabled={item.disabled}
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
        aria-hidden={!modalOpen}
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
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
                    disabled={loadingRoles}
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
                        .map((role) => {
                          const checkboxId = `assign-role-${role.id}`;
                          const roleId = String(role.id);
                          const checked = selectedRoleIds.has(roleId);
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
                                  );
                                }}
                                disabled={saving}
                              />
                              <label
                                className="custom-control-label"
                                htmlFor={checkboxId}
                              >
                                {role.name || ""}
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
                  disabled={saving || loadingRoles}
                >
                  {saving ? "Saving..." : "Save Changes"}
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
