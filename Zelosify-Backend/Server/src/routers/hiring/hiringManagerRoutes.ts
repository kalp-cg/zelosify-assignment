import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import { HiringContractController } from "../../controllers/hiring/hiringContractController.js";
import { fetchData } from "../../controllers/controllers.js";

const router = Router();

/**
 * =============================================================================
 * HIRING MANAGER PERSONA - VACANCY & PROFILE MANAGEMENT
 * Role: HIRING_MANAGER
 * Mandatory Rule: opening.hiringManagerId === loggedInUser.id
 * =============================================================================
 */

// 1. Fetch Openings (only own openings)
router.get(
  "/openings",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  HiringContractController.getMyOpenings as RequestHandler
);

// 2. Fetch Profiles for an Opening (includes AI recommendations, score, confidence, latency)
router.get(
  "/openings/:id/profiles",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  HiringContractController.getOpeningProfiles as RequestHandler
);

// 3. Shortlist Candidate Profile
router.post(
  "/profiles/:id/shortlist",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  HiringContractController.shortlistProfile as RequestHandler
);

// 4. Reject Candidate Profile
router.post(
  "/profiles/:id/reject",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  HiringContractController.rejectProfile as RequestHandler
);

// 5. Preview Profile File
router.get(
  "/profiles/:id/preview",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  HiringContractController.previewProfile as RequestHandler
);

// Legacy root route for backward compatibility
router.get(
  "/",
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  (async (req, res, next) => {
    try {
      await fetchData(req as any, res);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler
);

export default router;
