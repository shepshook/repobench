import { IPromptHandler, InteractionRule } from '../contracts';
import { z } from 'zod';

const InteractionRuleSchema = z.object({
  pattern: z.string(),
  response: z.string(),
});

const InteractionRulesSchema = z.array(InteractionRuleSchema);

/**
 * PromptHandler monitors the PTY output stream for specific prompt patterns
 * and returns the corresponding auto-response if a match is found.
 */
export class PromptHandler implements IPromptHandler {
  private compiledRules: { regex: RegExp; response: string }[] = [];
  private buffer: string = '';
  private readonly MAX_BUFFER_SIZE = 4096;

  /**
   * Updates the set of interaction rules used to match prompts.
   * @param rules Array of rules containing a regex pattern and its corresponding response.
   * @throws Error if any regex pattern is invalid.
   */
  setRules(rules: InteractionRule[]): void {
    const validatedRules = InteractionRulesSchema.parse(rules);
    this.compiledRules = validatedRules.map((rule) => ({
      regex: new RegExp(rule.pattern),
      response: rule.response,
    }));
  }

  /**
   * Analyzes the provided stream data to see if it matches any active prompt rules.
   * @param data The current chunk of data from the PTY stream.
   * @returns The response string to inject if a prompt is matched, otherwise null.
   */
  handle(data: string): string | null {
    if (this.compiledRules.length === 0) {
      return null;
    }

    this.buffer += data;

    // Maintain buffer size to prevent memory leaks
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE);
    }

    for (const rule of this.compiledRules) {
      if (rule.regex.test(this.buffer)) {
        // Security Validation Layer:
        // Ensure the auto-response is not performing potentially dangerous operations
        // unless explicitly allowed by the rule.
        if (this.validateResponse(rule.response)) {
          this.buffer = ''; // Clear buffer after successful match
          return rule.response;
        }
      }
    }

    return null;
  }

  /**
   * Validation layer to ensure auto-approvals match strict security rules.
   * This prevents the injection of malicious or accidentally destructive commands.
   */
  private validateResponse(response: string): boolean {
    // Basic security rules:
    // 1. Prevent responses that contain shell metacharacters that could be used for command injection
    //    if the response is not a simple 'y', 'n', or similar short answer.
    // 2. Limit response length to prevent buffer overflow or denial of service.
    
    if (response.length > 100) {
      return false;
    }

    // For more complex responses, we check for dangerous characters
    // Includes shell metacharacters and control characters (0x00-0x1F, 0x7F)
    const dangerousChars = /[;&|`$><\n\r\x00-\x1F\x7F]/;
    if (dangerousChars.test(response)) {
      return false;
    }

    // If it's a simple alphanumeric response, it's generally safe
    if (/^[a-zA-Z0-9\s,.\-]+$/.test(response)) {
      return true;
    }

    return true;
  }
}
