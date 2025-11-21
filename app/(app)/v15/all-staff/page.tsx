"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  deleteStaff,
  listStaff,
  type Staff,
  type StaffListResponse,
} from "@/lib/staff";
import { useAuth } from "@/contexts/AuthContext";

interface FilterState {
  search: string;
  role: string;
}

const initialFilter: FilterState = {
  search: "",
  role: "",
};

const availableRoles = ["Teacher", "Accountant", "Administrator", "Counselor", "Support"];

export default function AllStaffPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState<FilterState>(initialFilter);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [sortBy, setSortBy] = useState("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [data, setData] = useState<StaffListResponse | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listStaff({
        page,
        per_page: perPage,
        sortBy,
        sortDirection,
        search: filters.search || undefined,
        role: filters.role || undefined,
      });
      setData(response);
      setStaff(response.data ?? []);
      setError(null);
    } catch (err) {
      console.error("Unable to load staff", err);
      setError(
        err instanceof Error ? err.message : "Unable to load staff records.",
      );
      setData(null);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sortBy, sortDirection]);

  useEffect(() => {
    fetchStaff().catch((err) => console.error(err));
  }, [fetchStaff]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    fetchStaff().catch((err) => console.error(err));
  };

  const toggleSort = (column: string) => {
    setPage(1);
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const handleDelete = async (item: Staff) => {
    if (!window.confirm(`Delete staff profile for "${item.full_name ?? item.user?.name ?? ""}"?`)) {
      return;
    }
    try {
      await deleteStaff(item.id);
      await fetchStaff();
    } catch (err) {
      console.error("Unable to delete staff", err);
      alert(
        err instanceof Error ? err.message : "Unable to delete staff profile.",
      );
    }
  };

  const summary =
    data && data.total
      ? `Showing ${data.from ?? 0}-${data.to ?? 0} of ${data.total} staff`
      : "";

  const totalPages = data?.last_page ?? 1;

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) {
      return null;
    }
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const canCreateStaff = hasPermission("staff.create");
  const canDeleteStaff = hasPermission("staff.delete");

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Staff Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Staff</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>All Staff</h3>
            </div>
            <div className="dropdown">
              {canCreateStaff ? (
                <Link href="/v15/add-staff" className="btn btn-outline-primary mr-3">
                  <i className="fas fa-user-plus mr-1" />
                  Add Staff
                </Link>
              ) : null}
              <a
                className="dropdown-toggle"
                href="#"
                role="button"
                data-toggle="dropdown"
                aria-expanded="false"
              >
                ...
              </a>
              <div className="dropdown-menu dropdown-menu-right">
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() => fetchStaff().catch(() => undefined)}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <form className="row gutters-8 align-items-end mb-3" onSubmit={handleSearch}>
            <div className="col-lg-4 col-md-6 col-12 form-group">
              <label className="text-dark-medium" htmlFor="staff-search">
                Search
              </label>
              <input
                id="staff-search"
                type="text"
                placeholder="Name, email or phone"
                className="form-control"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
              />
            </div>
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label className="text-dark-medium" htmlFor="filter-role">
                Role
              </label>
              <select
                id="filter-role"
                className="form-control"
                value={filters.role}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }))
                }
              >
                <option value="">All Roles</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-6 col-12 form-group">
              <button
                id="staff-search-btn"
                type="submit"
                className="fw-btn-fill btn-gradient-yellow w-100"
              >
                Search
              </button>
            </div>
            <div className="col-lg-2 col-md-6 col-12 form-group">
              <Link
                href="/v15/add-staff"
                className="fw-btn-fill btn-gradient-yellow w-100"
              >
                Add Staff
              </Link>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("full_name")} className="sortable">
                    Name{renderSortIndicator("full_name")}
                  </th>
                  <th onClick={() => toggleSort("email")} className="sortable">
                    Email{renderSortIndicator("email")}
                  </th>
                  <th onClick={() => toggleSort("phone")} className="sortable">
                    Phone{renderSortIndicator("phone")}
                  </th>
                  <th onClick={() => toggleSort("role")} className="sortable">
                    Role{renderSortIndicator("role")}
                  </th>
                  <th>Gender</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      Loading staff…
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No staff found.
                    </td>
                  </tr>
                ) : (
                  staff.map((item) => (
                    <tr key={item.id}>
                      <td>{item.full_name ?? item.user?.name ?? "N/A"}</td>
                      <td>{item.email ?? item.user?.email ?? "N/A"}</td>
                      <td>{item.phone ?? item.user?.phone ?? "N/A"}</td>
                      <td>{item.role ?? "N/A"}</td>
                      <td className="text-capitalize">
                        {item.gender ?? "N/A"}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            href={`/v15/edit-staff?id=${item.id}`}
                            className="btn btn-sm btn-outline-primary mr-1"
                          >
                            Edit
                          </Link>
                          {canDeleteStaff ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(item)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
            <div className="text-muted mb-2">{summary}</div>
            <nav className="mb-2">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    «
                  </button>
                </li>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <li
                      key={pageNumber}
                      className={`page-item ${pageNumber === page ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    </li>
                  );
                })}
                <li
                  className={`page-item ${page >= totalPages ? "disabled" : ""}`}
                >
                  <button
                    type="button"
                    className="page-link"
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page >= totalPages}
                  >
                    »
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
