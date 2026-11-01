"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  MapPin,
  Calendar,
  User,
  Search,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
} from "lucide-react";
import axiosInstance from "@/utils/Axios/AxiosInstance";

export default function VendorOpeningsPage() {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOpenings = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      };
      const res = await axiosInstance.get("/vendor/openings", { params });
      if (res.data?.success) {
        setOpenings(res.data.data || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalCount(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to load vendor openings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOpenings();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Open
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Closed
          </span>
        );
      case "ON_HOLD":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            On Hold
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>IT Vendor Portal</span>
            <span>/</span>
            <span className="text-foreground font-medium">Contract Openings</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            Available Contract Openings
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse active contract positions, review requirements, and submit qualified candidate profiles.
          </p>
        </div>
        <button
          onClick={fetchOpenings}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-card-foreground text-sm font-medium transition shadow-sm w-fit"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, location, or contract type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open Only</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Total: {totalCount} positions
          </span>
        </div>
      </div>

      {/* Openings Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4">Title</th>
                <th scope="col" className="px-6 py-4">Location</th>
                <th scope="col" className="px-6 py-4">Contract Type</th>
                <th scope="col" className="px-6 py-4">Posted Date</th>
                <th scope="col" className="px-6 py-4">Hiring Manager Name</th>
                <th scope="col" className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                // Skeleton loading state
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded w-48 mb-2"></div>
                      <div className="h-3 bg-muted/60 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded w-28"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 bg-muted rounded w-20 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : openings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-base font-medium">No contract openings found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try adjusting your search criteria or filter.
                    </p>
                  </td>
                </tr>
              ) : (
                openings.map((op) => (
                  <tr
                    key={op.id}
                    className="hover:bg-muted/40 transition group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/vendor/openings/${op.id}`}
                        className="font-semibold text-foreground group-hover:text-primary transition flex items-center gap-2"
                      >
                        {op.title}
                        {getStatusBadge(op.status)}
                      </Link>
                      <span className="text-xs text-muted-foreground mt-0.5 block line-clamp-1">
                        Exp: {op.experienceMin} - {op.experienceMax ?? "10+"} yrs
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {op.location || "Remote"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {op.contractType || "Contract"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {new Date(op.postedDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {op.hiringManagerName || "Hiring Manager"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/vendor/openings/${op.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition shadow-sm"
                      >
                        View & Submit
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs rounded-md border border-border bg-background disabled:opacity-40 hover:bg-muted transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 text-xs rounded-md border border-border bg-background disabled:opacity-40 hover:bg-muted transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
