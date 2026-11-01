"use client";

import React, { useState, useEffect, useMemo, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  Zap,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Search,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import axiosInstance from "@/utils/Axios/AxiosInstance";

// Error Boundary Component per specification
class ProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ProfileErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-rose-600 dark:text-rose-400">Something went wrong displaying candidate profiles.</h3>
          <p className="text-xs text-muted-foreground">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg mt-2"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HiringManagerOpeningDetailsPage({ params }) {
  const unwrappedParams = use(params);
  const openingId = unwrappedParams.id;

  const [opening, setOpening] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("ALL"); // ALL, RECOMMENDED, BORDERLINE, SHORTLISTED, REJECTED
  const [searchTerm, setSearchTerm] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchOpeningAndProfiles = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/hiring-manager/openings/${openingId}/profiles`);
      if (res.data?.success) {
        setOpening(res.data.data.opening);
        setProfiles(res.data.data.profiles || []);
      }
    } catch (err) {
      console.error("Failed to load opening profiles:", err);
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to load candidate profiles.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (openingId) {
      fetchOpeningAndProfiles();
    }
  }, [openingId]);

  // Handle Shortlist action
  const handleShortlist = async (profileId) => {
    try {
      setActionInProgress(profileId);
      const res = await axiosInstance.post(`/hiring-manager/profiles/${profileId}/shortlist`);
      if (res.data?.success) {
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profileId
              ? { ...p, status: "SHORTLISTED", shortlistedAt: new Date() }
              : p
          )
        );
        setToastMessage({ type: "success", text: "Candidate profile shortlisted!" });
      }
    } catch (err) {
      console.error("Shortlist error:", err);
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to shortlist profile.",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Reject action
  const handleReject = async (profileId) => {
    try {
      setActionInProgress(profileId);
      const res = await axiosInstance.post(`/hiring-manager/profiles/${profileId}/reject`);
      if (res.data?.success) {
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profileId
              ? { ...p, status: "REJECTED", rejectedAt: new Date() }
              : p
          )
        );
        setToastMessage({ type: "success", text: "Candidate profile rejected." });
      }
    } catch (err) {
      console.error("Reject error:", err);
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to reject profile.",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Preview
  const handlePreview = async (profileId) => {
    try {
      const res = await axiosInstance.get(`/hiring-manager/profiles/${profileId}/preview`);
      if (res.data?.data?.previewUrl) {
        window.open(res.data.data.previewUrl, "_blank");
      }
    } catch (err) {
      console.error("Preview error:", err);
      alert("Unable to generate preview URL.");
    }
  };

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Tab filter
      if (filterTab === "RECOMMENDED" && p.recommendationBadge !== "Recommended") return false;
      if (filterTab === "BORDERLINE" && p.recommendationBadge !== "Borderline") return false;
      if (filterTab === "SHORTLISTED" && p.status !== "SHORTLISTED") return false;
      if (filterTab === "REJECTED" && p.status !== "REJECTED") return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesFile = p.fileName?.toLowerCase().includes(term);
        const matchesReason = p.explanation?.toLowerCase().includes(term);
        return matchesFile || matchesReason;
      }
      return true;
    });
  }, [profiles, filterTab, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = profiles.length;
    const recommended = profiles.filter((p) => p.recommendationBadge === "Recommended").length;
    const borderline = profiles.filter((p) => p.recommendationBadge === "Borderline").length;
    const shortlisted = profiles.filter((p) => p.status === "SHORTLISTED").length;
    const latencies = profiles.map((p) => p.processingTimeMs).filter(Boolean);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    return { total, recommended, borderline, shortlisted, avgLatency };
  }, [profiles]);

  // Virtualization Windowing State for lists > 50 records
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const ITEM_HEIGHT = 210; // Approximate profile card height in pixels
  const isVirtualizationActive = filteredProfiles.length > 50;

  const visibleRange = useMemo(() => {
    if (!isVirtualizationActive) {
      return { start: 0, end: filteredProfiles.length };
    }
    const visibleCount = 8;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
    const end = Math.min(filteredProfiles.length, start + visibleCount + 4);
    return { start, end };
  }, [scrollTop, filteredProfiles.length, isVirtualizationActive]);

  return (
    <ProfileErrorBoundary>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div>
          <Link
            href="/hiring-manager/openings"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to My Openings
          </Link>

          {/* Toast alert */}
          {toastMessage && (
            <div
              className={`p-3.5 rounded-xl mb-4 text-sm flex items-center justify-between border ${
                toastMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              <span>{toastMessage.text}</span>
              <button onClick={() => setToastMessage(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {opening?.contractType || "Contract"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {opening?.status || "Active"}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Sparkles className="h-7 w-7 text-primary" />
                {opening?.title || "Candidate Evaluation"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Location: {opening?.location || "Remote"} • Experience: {opening?.experienceMin} - {opening?.experienceMax ?? "10+"} yrs
              </p>
            </div>

            <button
              onClick={fetchOpeningAndProfiles}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-card-foreground text-sm font-medium transition shadow-sm w-fit"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm text-center">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Total Candidates</span>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          </div>
          <div className="bg-card border border-emerald-500/30 p-4 rounded-xl shadow-sm text-center">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Recommended</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.recommended}</p>
          </div>
          <div className="bg-card border border-amber-500/30 p-4 rounded-xl shadow-sm text-center">
            <span className="text-xs text-amber-600 dark:text-amber-400 uppercase font-semibold">Borderline</span>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.borderline}</p>
          </div>
          <div className="bg-card border border-primary/30 p-4 rounded-xl shadow-sm text-center">
            <span className="text-xs text-primary uppercase font-semibold">Shortlisted</span>
            <p className="text-2xl font-bold text-primary mt-1">{stats.shortlisted}</p>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm text-center">
            <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" /> Avg AI Latency
            </span>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.avgLatency}ms</p>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card border border-border p-3.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            {[
              { id: "ALL", label: "All Candidates" },
              { id: "RECOMMENDED", label: "Recommended (≥75%)" },
              { id: "BORDERLINE", label: "Borderline (50-74%)" },
              { id: "SHORTLISTED", label: "Shortlisted" },
              { id: "REJECTED", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  filterTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name or reasoning..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Profile Cards Container (with Virtualization for > 50 records) */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse"
              >
                <div className="flex justify-between">
                  <div className="h-5 bg-muted rounded w-48"></div>
                  <div className="h-5 bg-muted rounded w-24"></div>
                </div>
                <div className="h-12 bg-muted/60 rounded"></div>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-base font-semibold text-foreground">No candidate profiles found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {profiles.length === 0
                ? "No profiles have been submitted by vendors for this position yet."
                : "No profiles match your active filters."}
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            onScroll={(e) => isVirtualizationActive && setScrollTop(e.currentTarget.scrollTop)}
            style={
              isVirtualizationActive
                ? {
                    height: "750px",
                    overflowY: "auto",
                    position: "relative",
                  }
                : {}
            }
            className="space-y-4"
          >
            {isVirtualizationActive && (
              <div
                style={{
                  height: `${filteredProfiles.length * ITEM_HEIGHT}px`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: "none",
                }}
              />
            )}

            {filteredProfiles
              .slice(visibleRange.start, visibleRange.end)
              .map((p, idx) => {
                const actualIndex = visibleRange.start + idx;
                const isShortlisted = p.status === "SHORTLISTED";
                const isRejected = p.status === "REJECTED";

                return (
                  <div
                    key={p.id}
                    style={
                      isVirtualizationActive
                        ? {
                            transform: `translateY(${actualIndex * ITEM_HEIGHT}px)`,
                            position: "absolute",
                            left: 0,
                            right: 0,
                            height: `${ITEM_HEIGHT - 16}px`,
                          }
                        : {}
                    }
                    className={`bg-card border rounded-2xl p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                      isShortlisted
                        ? "border-emerald-500/50 bg-emerald-500/[0.02]"
                        : isRejected
                        ? "border-rose-500/50 bg-rose-500/[0.02]"
                        : "border-border"
                    }`}
                  >
                    {/* Top Row: File Name, Upload Date, Recommendation Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-sm tracking-tight truncate max-w-xs md:max-w-md">
                              {p.fileName || p.s3Key}
                            </h3>
                            {isShortlisted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Shortlisted
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Rejected
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Uploaded: {new Date(p.submittedAt).toLocaleDateString()} at{" "}
                            {new Date(p.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      {/* Recommendation Badge */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {p.recommendationBadge === "Recommended" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Recommended
                          </span>
                        )}
                        {p.recommendationBadge === "Borderline" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Borderline
                          </span>
                        )}
                        {p.recommendationBadge === "Not Recommended" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <X className="h-3.5 w-3.5" />
                            Not Recommended
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: AI Score %, Confidence %, Latency, Explanation */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 my-2 border-y border-border text-xs">
                      {/* Metric 1: Match Score % */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Match Score</span>
                          <span className="font-bold text-sm text-foreground">
                            {p.score != null ? `${p.score}%` : "Pending"}
                          </span>
                        </div>
                      </div>

                      {/* Metric 2: Confidence % */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">AI Confidence</span>
                          <span className="font-bold text-sm text-foreground">
                            {p.confidence != null ? `${p.confidence}%` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Metric 3: Processing Time / Latency */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Processing Latency</span>
                          <span className="font-bold text-sm text-foreground">
                            {p.processingTimeMs != null ? `${p.processingTimeMs}ms` : "< 1s"}
                          </span>
                        </div>
                      </div>

                      {/* AI Reasoning / Explanation */}
                      <div className="md:col-span-1 border-l md:border-border pl-0 md:pl-3">
                        <span className="text-muted-foreground block text-[11px] font-semibold text-primary">
                          AI Reasoning:
                        </span>
                        <p className="text-muted-foreground line-clamp-2 mt-0.5 italic">
                          "{p.explanation || "No explanation recorded."}"
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Actions (Preview, Shortlist, Reject) */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        onClick={() => handlePreview(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition shadow-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Preview Resume
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionInProgress === p.id || isRejected}
                          onClick={() => handleReject(p.id)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                            isRejected
                              ? "bg-rose-500/20 text-rose-500 border-rose-500/30 cursor-not-allowed"
                              : "border-border bg-card hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 text-muted-foreground"
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {isRejected ? "Rejected" : "Reject"}
                        </button>

                        <button
                          disabled={actionInProgress === p.id || isShortlisted}
                          onClick={() => handleShortlist(p.id)}
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
                            isShortlisted
                              ? "bg-emerald-500 text-white cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {isShortlisted ? "Shortlisted" : "Shortlist"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </ProfileErrorBoundary>
  );
}
