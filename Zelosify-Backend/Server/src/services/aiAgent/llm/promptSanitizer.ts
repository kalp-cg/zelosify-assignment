/**
 * Prompt Injection Sanitizer
 * Mitigates adversarial injection attempts from untrusted candidate resumes/documents
 */

export class PromptSanitizer {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /you\s+are\s+now\s+(a|an|the)\s+/gi,
    /system\s*:\s*/gi,
    /user\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /<\/?system>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /override\s+score\s+(to|=)\s+/gi,
    /set\s+recommend(ed|ation)?\s+(to|=)\s+/gi,
    /give\s+this\s+candidate\s+(a\s+)?(100%|perfect|high)\s+score/gi,
    /always\s+recommend\s+this/gi,
  ];

  /**
   * Sanitizes untrusted text extracted from candidate resumes
   */
  public static sanitize(input: string, maxLength: number = 8000): {
    sanitized: string;
    flaggedPatterns: string[];
    isSanitized: boolean;
  } {
    if (!input || typeof input !== "string") {
      return { sanitized: "", flaggedPatterns: [], isSanitized: false };
    }

    let text = input;
    const flaggedPatterns: string[] = [];

    // 1. Strip null bytes and non-printable control characters (keep standard newlines & tabs)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

    // 2. Scan and neutralize known injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        flaggedPatterns.push(pattern.source);
        text = text.replace(pattern, "[REDACTED_SECURITY_POLICY]");
      }
    }

    // 3. Enforce maximum text length to prevent context-overflow denial of service
    if (text.length > maxLength) {
      text = text.slice(0, maxLength);
    }

    return {
      sanitized: text.trim(),
      flaggedPatterns,
      isSanitized: flaggedPatterns.length > 0,
    };
  }
}
