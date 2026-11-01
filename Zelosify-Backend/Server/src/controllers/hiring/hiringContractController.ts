import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/typeIndex.js";
import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../../services/storage/storageFactory.js";

export class HiringContractController {
  /**
   * GET /api/hiring-manager/openings
   * Returns only openings belonging to the logged-in hiring manager.
   * Mandatory check: opening.hiringManagerId === loggedInUser.id
   */
  public static async getMyOpenings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const managerId = req.user?.id;
      const tenantId = req.user?.tenant?.tenantId;

      if (!managerId || !tenantId) {
        res.status(401).json({ message: "Unauthorized or missing credentials." });
        return;
      }

      const openings = await prisma.opening.findMany({
        where: {
          tenantId,
          hiringManagerId: managerId,
        },
        include: {
          _count: {
            select: {
              hiringProfiles: {
                where: { isDeleted: false },
              },
            },
          },
        },
        orderBy: { postedDate: "desc" },
      });

      const formatted = openings.map((op) => ({
        id: op.id,
        title: op.title,
        description: op.description,
        location: op.location,
        contractType: op.contractType,
        experienceMin: op.experienceMin,
        experienceMax: op.experienceMax,
        postedDate: op.postedDate,
        status: op.status,
        profilesCount: op._count.hiringProfiles,
      }));

      res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error: any) {
      console.error("[HiringContractController.getMyOpenings] Error:", error);
      res.status(500).json({ message: "Failed to fetch openings.", error: error.message });
    }
  }

  /**
   * GET /api/hiring-manager/openings/:id/profiles
   * Returns submitted profiles for an opening.
   * Mandatory check: opening.hiringManagerId === loggedInUser.id
   * Must include: Recommendation badge, score, confidence, explanation, latency.
   */
  public static async getOpeningProfiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const managerId = req.user?.id;
      const tenantId = req.user?.tenant?.tenantId;

      if (!managerId || !tenantId) {
        res.status(401).json({ message: "Unauthorized or missing credentials." });
        return;
      }

      // Verify that this opening belongs to the logged-in hiring manager
      const opening = await prisma.opening.findFirst({
        where: { id, tenantId },
      });

      if (!opening) {
        res.status(404).json({ message: "Opening not found." });
        return;
      }

      if (opening.hiringManagerId !== managerId) {
        res.status(403).json({ message: "Forbidden: You cannot view profiles for other managers' openings." });
        return;
      }

      const profiles = await prisma.hiringProfile.findMany({
        where: {
          openingId: id,
          isDeleted: false,
        },
        orderBy: [
          { recommendationScore: "desc" },
          { submittedAt: "desc" },
        ],
      });

      const formatted = profiles.map((p) => {
        const parts = p.s3Key.split("/");
        const rawFileName = parts[parts.length - 1] || p.s3Key;
        const cleanName = rawFileName.replace(/^\d+_/, "");

        // Compute badge category based on score
        let recommendationBadge: "Recommended" | "Borderline" | "Not Recommended" | "Pending";
        if (p.recommendationScore == null) {
          recommendationBadge = "Pending";
        } else if (p.recommendationScore >= 0.75) {
          recommendationBadge = "Recommended";
        } else if (p.recommendationScore >= 0.5) {
          recommendationBadge = "Borderline";
        } else {
          recommendationBadge = "Not Recommended";
        }

        return {
          id: p.id,
          openingId: p.openingId,
          fileName: cleanName,
          s3Key: p.s3Key,
          uploadedBy: p.uploadedBy,
          submittedAt: p.submittedAt,
          status: p.status,
          shortlistedBy: p.shortlistedBy,
          shortlistedAt: p.shortlistedAt,
          rejectedBy: p.rejectedBy,
          rejectedAt: p.rejectedAt,
          // AI Agent fields
          recommended: p.recommended,
          recommendationBadge,
          score: p.recommendationScore != null ? Math.round(p.recommendationScore * 100) : null,
          rawScore: p.recommendationScore,
          confidence: p.recommendationConfidence != null ? Math.round(p.recommendationConfidence * 100) : null,
          explanation: p.recommendationReason,
          processingTimeMs: p.recommendationLatencyMs,
          recommendationVersion: p.recommendationVersion,
          recommendedAt: p.recommendedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          opening: {
            id: opening.id,
            title: opening.title,
            location: opening.location,
            contractType: opening.contractType,
            experienceMin: opening.experienceMin,
            experienceMax: opening.experienceMax,
            status: opening.status,
          },
          profiles: formatted,
        },
      });
    } catch (error: any) {
      console.error("[HiringContractController.getOpeningProfiles] Error:", error);
      res.status(500).json({ message: "Failed to fetch candidate profiles.", error: error.message });
    }
  }

  /**
   * POST /api/hiring-manager/profiles/:id/shortlist
   * Shortlist candidate profile
   */
  public static async shortlistProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const profileId = parseInt(req.params.id);
      const managerId = req.user?.id;
      const tenantId = req.user?.tenant?.tenantId;

      if (!profileId || isNaN(profileId)) {
        res.status(400).json({ message: "Valid profile ID required." });
        return;
      }

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: profileId },
        include: { opening: true },
      });

      if (!profile || profile.isDeleted) {
        res.status(404).json({ message: "Profile not found." });
        return;
      }

      if (profile.opening.hiringManagerId !== managerId || profile.opening.tenantId !== tenantId) {
        res.status(403).json({ message: "Forbidden: You can only shortlist profiles under your own openings." });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        return await tx.hiringProfile.update({
          where: { id: profileId },
          data: {
            status: "SHORTLISTED",
            shortlistedBy: managerId,
            shortlistedAt: new Date(),
            rejectedBy: null,
            rejectedAt: null,
          },
        });
      });

      res.status(200).json({
        success: true,
        message: "Candidate profile shortlisted successfully.",
        data: updated,
      });
    } catch (error: any) {
      console.error("[HiringContractController.shortlistProfile] Error:", error);
      res.status(500).json({ message: "Failed to shortlist profile.", error: error.message });
    }
  }

  /**
   * POST /api/hiring-manager/profiles/:id/reject
   * Reject candidate profile
   */
  public static async rejectProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const profileId = parseInt(req.params.id);
      const managerId = req.user?.id;
      const tenantId = req.user?.tenant?.tenantId;

      if (!profileId || isNaN(profileId)) {
        res.status(400).json({ message: "Valid profile ID required." });
        return;
      }

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: profileId },
        include: { opening: true },
      });

      if (!profile || profile.isDeleted) {
        res.status(404).json({ message: "Profile not found." });
        return;
      }

      if (profile.opening.hiringManagerId !== managerId || profile.opening.tenantId !== tenantId) {
        res.status(403).json({ message: "Forbidden: You can only reject profiles under your own openings." });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        return await tx.hiringProfile.update({
          where: { id: profileId },
          data: {
            status: "REJECTED",
            rejectedBy: managerId,
            rejectedAt: new Date(),
            shortlistedBy: null,
            shortlistedAt: null,
          },
        });
      });

      res.status(200).json({
        success: true,
        message: "Candidate profile rejected successfully.",
        data: updated,
      });
    } catch (error: any) {
      console.error("[HiringContractController.rejectProfile] Error:", error);
      res.status(500).json({ message: "Failed to reject profile.", error: error.message });
    }
  }

  /**
   * GET /api/hiring-manager/profiles/:id/preview
   * Generate secure preview URL for resume
   */
  public static async previewProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const profileId = parseInt(req.params.id);
      const managerId = req.user?.id;
      const tenantId = req.user?.tenant?.tenantId;

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: profileId },
        include: { opening: true },
      });

      if (!profile || profile.isDeleted) {
        res.status(404).json({ message: "Profile not found." });
        return;
      }

      if (profile.opening.hiringManagerId !== managerId || profile.opening.tenantId !== tenantId) {
        res.status(403).json({ message: "Forbidden: Access denied to other managers' openings." });
        return;
      }

      const storageService = createStorageService();
      const previewUrl = await storageService.getObjectURL(profile.s3Key);

      res.status(200).json({
        success: true,
        data: {
          previewUrl,
          s3Key: profile.s3Key,
        },
      });
    } catch (error: any) {
      console.error("[HiringContractController.previewProfile] Error:", error);
      res.status(500).json({ message: "Failed to generate preview URL.", error: error.message });
    }
  }
}
