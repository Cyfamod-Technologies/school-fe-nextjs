"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteClass,
  listClasses,
  type SchoolClass,
} from "@/lib/classes";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS } from "@/lib/permissionKeys";

export default function AllClassesPage() {
  const { hasPermission, user } = useAuth();
  
  // Check if user is admin (admins bypass permission checks)
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

  const canCreateClass = isAdmin || hasPermission(PERMISSIONS.CLASSES_CREATE);
  const canUpdateClass = isAdmin || hasPermission(PERMISSIONS.CLASSES_UPDATE);
  const canDeleteClass = isAdmin || hasPermission(PERMISSIONS.CLASSES_DELETE);

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClasses();
      setClasses(data);
      setError(null);
    } catch (err) {
      console.error("Unable to load classes", err);
      setError(
        err instanceof Error ? err.message : "Unable to load classes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses().catch((err) => console.error(err));
  }, [loadClasses]);

  const handleDelete = async (item: SchoolClass) => {
    if (!window.confirm(`Delete class "${item.name}"?`)) {
      return;
    }
    try {
      await deleteClass(item.id);
      await loadClasses();
    } catch (err) {
      console.error("Unable to delete class", err);
      alert(
        err instanceof Error ? err.message : "Unable to delete class.",
      );
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Class Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Classes</li>
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
              <h3>All Classes</h3>
            </div>
            <div className="dropdown">
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
                <button className="dropdown-item" type="button">
                  <i className="fas fa-times text-orange-red" />
                  Close
                </button>
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() =>
                    loadClasses().catch((err) =>
                      console.error("Unable to refresh classes", err),
                    )
                  }
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="text-right mb-3">
            {canCreateClass && (
              <Link
                href="/v12/add-class"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              >
                Add New Class
              </Link>
            )}
          </div>

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Class Name</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center">
                      Loading classes…
                    </td>
                  </tr>
                ) : classes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center">
                      No classes found.
                    </td>
                  </tr>
                ) : (
                  classes.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>
                        <div className="d-flex gap-2">
                          {canUpdateClass && (
                            <Link
                              className="btn btn-sm btn-outline-primary"
                              href={`/v12/edit-class?id=${item.id}`}
                            >
                              Edit
                            </Link>
                          )}
                          {canDeleteClass && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => handleDelete(item)}
                            >
                              Delete
                            </button>
                          )}
                          {!canUpdateClass && !canDeleteClass && (
                            <span className="text-muted">No actions</span>
                          )}
                        </div>
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
    </>
  );
}
