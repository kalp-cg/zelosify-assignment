"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  MapPin,
  Clock,
  Calendar,
  Users,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import axiosInstance from "@/utils/Axios/AxiosInstance";

export default function HiringManagerOpeningsPage() {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMyOpenings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/hiring-manager/openings");
      if (res.data?.success) {
        setOpenings(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load hiring manager openings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyOpenings();
  }, []);

  const filteredOpenings = openings.filter((op) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      op.title?.toLowerCase().includes(term) ||
      op.location?.toLowerCase().includes(term) ||
      op.contractType?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Hiring Manager</span>
            <span>/</span>
            <span className="text-foreground font-medium">My Openings</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            AI-Assisted Contract Hiring
          </h1>
          <p className="text-muted-foreground mt-1">
            Evaluate submitted candidate profiles with deterministic AI recommendations, scoring breakdowns, and 1-click shortlist/reject.
          </p>
        </div>

        <button
          onClick={fetchMyOpenings}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-card-foreground text-sm font-medium transition shadow-sm w-fit"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search my positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {filteredOpenings.length} of {openings.length} active positions
        </div>
      </div>

      {/* Openings Grid / Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="h-16 bg-muted/50 rounded"></div>
              <div className="h-8 bg-muted rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : filteredOpenings.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold text-foreground">No Openings Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            You do not currently have any assigned contract openings under this tenant.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOpenings.map((op) => (
            <div
              key={op.id}
              className="bg-card border border-border hover:border-primary/50 transition-all duration-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {op.contractType || "Contract"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {op.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                  {op.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {op.description || "Contract opening requirements and candidate evaluation."}
                </p>

                <div className="space-y-1.5 pt-2 text-xs text-muted-foreground border-t border-border">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{op.location || "Remote"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Required Experience: {op.experienceMin} - {op.experienceMax ?? "10+"} yrs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Posted: {new Date(op.postedDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{op.profilesCount || 0} candidate(s)</span>
                </div>

                <Link
                  href={`/hiring-manager/openings/${op.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  View Profiles & AI Scores
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
