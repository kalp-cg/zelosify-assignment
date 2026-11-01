import { SkillNormalizerTool } from "./skillNormalizerTool.js";
import type { CandidateFeatures, JobRequirements } from "../types.js";

export interface MatchingScores {
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  breakdown: {
    matchedSkills: string[];
    missingSkills: string[];
    experienceDiffNote: string;
    locationMatchNote: string;
  };
}

export class DeterministicMatchingTool {
  public static match(candidate: CandidateFeatures, job: JobRequirements): MatchingScores {
    // 1. Experience Logic
    // if candidateExp < min -> 0
    // if within range -> 1
    // if above max -> 0.8
    const candidateExp = Number(candidate.experienceYears) || 0;
    const minExp = Number(job.experienceMin) || 0;
    const maxExp = job.experienceMax != null ? Number(job.experienceMax) : null;

    let experienceMatchScore = 0;
    let experienceDiffNote = "";

    if (candidateExp < minExp) {
      experienceMatchScore = 0;
      experienceDiffNote = `Candidate has ${candidateExp} yrs, below minimum required ${minExp} yrs.`;
    } else if (maxExp !== null && candidateExp > maxExp) {
      experienceMatchScore = 0.8;
      experienceDiffNote = `Candidate has ${candidateExp} yrs, above maximum ${maxExp} yrs (overqualified penalty).`;
    } else {
      experienceMatchScore = 1.0;
      experienceDiffNote = `Candidate experience (${candidateExp} yrs) satisfies requirement [${minExp} - ${maxExp ?? "∞"}].`;
    }

    // 2. Skill Match Logic
    // overlap / requiredSkills
    const normCandidateSkills = SkillNormalizerTool.normalize(candidate.skills);
    const normRequiredSkills = SkillNormalizerTool.normalize(job.requiredSkills || []);

    const candidateSkillSet = new Set(normCandidateSkills.map((s) => s.toLowerCase()));
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const reqSkill of normRequiredSkills) {
      if (candidateSkillSet.has(reqSkill.toLowerCase())) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    }

    let skillMatchScore = 1.0;
    if (normRequiredSkills.length > 0) {
      skillMatchScore = matchedSkills.length / normRequiredSkills.length;
    } else {
      skillMatchScore = normCandidateSkills.length > 0 ? 1.0 : 0.5;
    }

    // Round to 3 decimal places
    skillMatchScore = Math.min(1.0, Math.max(0, Math.round(skillMatchScore * 1000) / 1000));

    // 3. Location Match Logic
    // Remote -> 1
    // Exact match -> 1
    // Onsite mismatch -> 0.5
    const jobLoc = (job.location || "Remote").trim().toLowerCase();
    const candLoc = (candidate.location || "Remote").trim().toLowerCase();

    let locationMatchScore = 0.5;
    let locationMatchNote = "";

    if (jobLoc === "remote" || candLoc === "remote") {
      locationMatchScore = 1.0;
      locationMatchNote = "Remote flexibility matched.";
    } else if (candLoc.includes(jobLoc) || jobLoc.includes(candLoc)) {
      locationMatchScore = 1.0;
      locationMatchNote = `Location exact match: ${candidate.location}.`;
    } else {
      locationMatchScore = 0.5;
      locationMatchNote = `Onsite mismatch: Job is in '${job.location}', candidate is in '${candidate.location}'.`;
    }

    return {
      skillMatchScore,
      experienceMatchScore,
      locationMatchScore,
      breakdown: {
        matchedSkills,
        missingSkills,
        experienceDiffNote,
        locationMatchNote,
      },
    };
  }
}
