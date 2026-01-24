"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  deleteParent,
  listParents,
  searchParents,
  type Parent,
} from "@/lib/parents";

function getEmail(parent: Parent): string {
  return (parent.user?.email ?? parent.email ?? "").trim() || "N/A";
}

export default function AllParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadParents = async () => {
    setLoading(true);
    try {
      const data = await listParents();
      setParents(data);
      setError(null);
    } catch (err) {
      console.error("Unable to load parents", err);
      setError(
        err instanceof Error ? err.message : "Unable to load parents.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParents().catch((err) => console.error(err));
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      loadParents().catch((err) => console.error(err));
      return;
    }
    setLoading(true);
    try {
      const data = await searchParents(query.trim());
      setParents(data);
      setError(null);
    } catch (err) {
      console.error("Unable to search parents", err);
      setError(
        err instanceof Error ? err.message : "Unable to search parents.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (parent: Parent) => {
    if (
      !window.confirm(
        `Delete parent "${parent.first_name} ${parent.last_name}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteParent(parent.id);
      await loadParents();
    } catch (err) {
      console.error("Unable to delete parent", err);
      alert(
        err instanceof Error ? err.message : "Unable to delete parent.",
      );
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Parent Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Parents</li>
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
              <h3>All Parents</h3>
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
                  onClick={() => loadParents().catch((err) => {
                    console.error("Unable to refresh parents", err);
                    alert(
                      err instanceof Error
                        ? err.message
                        : "Unable to refresh parents.",
                    );
                  })}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-lg-8 col-12">
              <form
                className="d-flex align-items-center"
                onSubmit={handleSearch}
              >
                <input
                  id="search-input"
                  type="text"
                  className="form-control mr-2"
                  placeholder="Search parents..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button
                  id="search-button"
                  type="submit"
                  className="btn btn-primary"
                >
                  Search
                </button>
              </form>
            </div>
            <div className="col-lg-4 col-12 d-flex justify-content-end">
              <Link
                href="/v13/add-parent"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              >
                Add Parent
              </Link>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Students</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      Loading parents…
                    </td>
                  </tr>
                ) : parents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No parents found.
                    </td>
                  </tr>
                ) : (
              parents.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.first_name} {item.last_name}
                  </td>
                  <td>{item.phone || "—"}</td>
                  <td>{getEmail(item)}</td>
                  <td>{item.students_count ?? item.students?.length ?? 0}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            className="btn btn-sm btn-outline-primary"
                            href={`/v13/edit-parent?id=${item.id}`}
                          >
                            Edit
                          </Link>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            type="button"
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </button>
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
      <style jsx>{`
        :global(.dataTables_wrapper .dataTables_paginate .pagination) {
          flex-wrap: wrap;
        }

        :global(.dataTables_wrapper .dataTables_paginate) {
          width: 100%;
        }

        @media (min-width: 768px) {
          :global(.dataTables_wrapper .dataTables_paginate) {
            width: auto;
          }
        }
      `}</style>
    </>
  );
}
