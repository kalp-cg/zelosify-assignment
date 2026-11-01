import { SchemaValidator } from "../validator/schemaValidator.js";
import type { DeterministicMatchResult } from "../types.js";
import type { MatchingScores } from "./deterministicMatchingTool.js";

export class ScoringEngineTool {
  /**
   * MANDATORY FORMULA:
   * FinalScore = (0.5 * skillMatchScore) + (0.3 * experienceMatchScore) + (0.2 * locationMatchScore)
   */
  public static calculate(scores: MatchingScores): DeterministicMatchResult {
    const skillScore = Math.max(0, Math.min(1, Number(scores.skillMatchScore) || 0));
    const expScore = Math.max(0, Math.min(1, Number(scores.experienceMatchScore) || 0));
    const locScore = Math.max(0, Math.min(1, Number(scores.locationMatchScore) || 0));

    const rawFinalScore = 0.5 * skillScore + 0.3 * expScore + 0.2 * locScore;
    const finalScore = Math.round(rawFinalScore * 100) / 100;

    const result: DeterministicMatchResult = {
      skillMatchScore: skillScore,
      experienceMatchScore: expScore,
      locationMatchScore: locScore,
      finalScore,
      breakdown: scores.breakdown,
    };

    const validation = SchemaValidator.validateScoringResult(result);
    if (!validation.valid) {
      throw new Error(`Scoring validation failed: ${validation.errors?.join(", ")}`);
    }

    return validation.data!;
  }
}
