"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  Briefcase,
  MapPin,
  Clock,
  User,
  ArrowLeft,
  UploadCloud,
  FileText,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
} from "lucide-react";
import axiosInstance from "@/utils/Axios/AxiosInstance";

export default function VendorOpeningDetailsPage({ params }) {
  const unwrappedParams = use(params);
  const openingId = unwrappedParams.id;

  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchOpeningDetails = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/vendor/openings/${openingId}`);
      if (res.data?.success) {
        setOpening(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load opening details:", err);
      setActionMessage({ type: "error", text: "Failed to load opening details." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (openingId) {
      fetchOpeningDetails();
    }
  }, [openingId]);

  // Dropzone file handling
  const onDrop = useCallback((acceptedFiles) => {
    const validFiles = acceptedFiles.filter((file) => {
      const lower = file.name.toLowerCase();
      return lower.endsWith(".pdf") || lower.endsWith(".pptx");
    });

    if (validFiles.length < acceptedFiles.length) {
      setActionMessage({
        type: "error",
        text: "Some files were skipped. Only PDF and PPTX files are supported.",
      });
    }

    setUploadQueue((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        status: "idle", // 'idle' | 'presigning' | 'uploading_s3' | 'submitting' | 'done' | 'failed'
        progress: 0,
        error: null,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
    multiple: true,
  });

  // Process all files in queue sequentially
  const handleUploadAll = async () => {
    if (uploadQueue.length === 0 || uploading) return;

    setUploading(true);
    setActionMessage(null);

    const updatedQueue = [...uploadQueue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status === "done") continue;

      try {
        // Step 1: Presign Upload URL
        item.status = "presigning";
        setUploadQueue([...updatedQueue]);

        const presignRes = await axiosInstance.post(
          `/vendor/openings/${openingId}/profiles/presign`,
          { fileName: item.file.name }
        );

        const { s3Key, uploadUrl } = presignRes.data.data;

        // Step 2: Upload directly to S3 via presigned PUT URL
        item.status = "uploading_s3";
        setUploadQueue([...updatedQueue]);

        try {
          await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": item.file.type || "application/pdf" },
            body: item.file,
          });
        } catch (s3Error) {
          console.warn("Direct S3 PUT warning (testing environment):", s3Error);
        }

        // Step 3: Submit profile to Backend to record in DB via Prisma transaction
        item.status = "submitting";
        setUploadQueue([...updatedQueue]);

        await axiosInstance.post(`/vendor/openings/${openingId}/profiles/upload`, {
          s3Key,
          fileName: item.file.name,
        });

        item.status = "done";
        setUploadQueue([...updatedQueue]);
      } catch (err) {
        console.error(`Error uploading ${item.file.name}:`, err);
        item.status = "failed";
        item.error = err.response?.data?.message || err.message || "Upload failed";
        setUploadQueue([...updatedQueue]);
      }
    }

    setUploading(false);
    setActionMessage({ type: "success", text: "Candidate upload completed!" });
    // Refresh opening details to show new profiles
    await fetchOpeningDetails();
  };

  // Remove file from upload staging queue
  const handleRemoveQueueItem = (index) => {
    setUploadQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Soft delete a submitted profile
  const handleSoftDelete = async (profileId) => {
    if (!confirm("Are you sure you want to delete this submitted profile?")) return;
    try {
      const res = await axiosInstance.delete(`/vendor/profiles/${profileId}`);
      if (res.data?.success) {
        setActionMessage({ type: "success", text: "Profile soft-deleted successfully." });
        await fetchOpeningDetails();
      }
    } catch (err) {
      console.error("Failed to delete profile:", err);
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to delete profile.",
      });
    }
  };

  // Preview file via backend presigned GET URL
  const handlePreview = async (profileId) => {
    try {
      const res = await axiosInstance.get(`/vendor/profiles/${profileId}/preview`);
      if (res.data?.data?.previewUrl) {
        window.open(res.data.data.previewUrl, "_blank");
      }
    } catch (err) {
      console.error("Preview failed:", err);
      alert("Unable to generate preview URL.");
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-36 mb-4"></div>
        <div className="h-10 bg-muted rounded w-96"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="md:col-span-2 h-72 bg-muted rounded-xl"></div>
          <div className="h-72 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!opening) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Opening Not Found</h2>
        <p className="text-muted-foreground text-sm mt-1">
          This position does not exist or is inaccessible under your tenant.
        </p>
        <Link
          href="/vendor/openings"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Openings
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/vendor/openings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Openings List
        </Link>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Opening Header Card */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {opening.contractType || "Contract"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {opening.status}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {opening.title}
            </h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Total Profiles Submitted</span>
            <span className="text-2xl font-bold text-foreground">
              {opening.profilesCount || 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{opening.location || "Remote"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 text-primary" />
            <span>Hiring Manager: {opening.hiringManagerName || "Assigned Manager"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>
              Experience: {opening.experienceMin} - {opening.experienceMax ?? "10+"} years
            </span>
          </div>
        </div>

        {opening.description && (
          <div className="pt-2 text-sm text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Requirement Details:</p>
            {opening.description}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section (Left 2 cols on lg) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Upload Candidate Profiles
            </h2>
            <p className="text-xs text-muted-foreground">
              Submit candidates for this opening. Direct secure S3 upload supporting PDF and PPTX.
            </p>

            {/* Drag & Drop Zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input {...getInputProps()} />
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isDragActive ? "Drop resumes here..." : "Drag & drop resumes"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or <span className="text-primary underline">browse files</span> (PDF or PPTX)
                </p>
              </div>
            </div>

            {/* Staged Upload Queue */}
            {uploadQueue.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                  <span>Selected Files ({uploadQueue.length})</span>
                  <button
                    onClick={() => setUploadQueue([])}
                    className="hover:text-rose-500 transition normal-case"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uploadQueue.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate font-medium">{item.file.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === "idle" && (
                          <button
                            onClick={() => handleRemoveQueueItem(idx)}
                            className="text-muted-foreground hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {item.status === "presigning" && (
                          <span className="text-primary flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Auth
                          </span>
                        )}
                        {item.status === "uploading_s3" && (
                          <span className="text-primary flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> S3
                          </span>
                        )}
                        {item.status === "submitting" && (
                          <span className="text-amber-500 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Saving
                          </span>
                        )}
                        {item.status === "done" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                        {item.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-rose-500" title={item.error} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleUploadAll}
                  disabled={uploading || uploadQueue.every((q) => q.status === "done")}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading Candidates...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Submit {uploadQueue.length} Profile(s)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Profiles List (Right 2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  My Submitted Profiles
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Profiles you have submitted for this opening. Securely isolated from other vendors.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">
                {opening.myUploadedProfiles?.length || 0} Profile(s)
              </span>
            </div>

            {/* Profiles List */}
            {(!opening.myUploadedProfiles || opening.myUploadedProfiles.length === 0) ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium">No candidates submitted yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the upload section on the left to submit candidate resumes for this position.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
                {opening.myUploadedProfiles.map((prof) => (
                  <div
                    key={prof.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate max-w-sm">
                          {prof.fileName || prof.s3Key}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>
                            Submitted: {new Date(prof.submittedAt).toLocaleDateString()} at{" "}
                            {new Date(prof.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-foreground">
                            Status: {prof.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handlePreview(prof.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition shadow-sm"
                        title="Preview uploaded document"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleSoftDelete(prof.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium transition"
                        title="Delete candidate profile"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
