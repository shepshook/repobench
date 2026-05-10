import { describe, it, expect } from 'vitest';
import { isChangeSignificant } from '../../src/utils/git-utils';

describe('isChangeSignificant', () => {
  it('should return false for whitespace-only changes', () => {
    const diff = `
--- a/file.js
+++ b/file.js
@@ -1,1 +1,1 @@
- 
+  
    `;
    expect(isChangeSignificant(diff)).toBe(false);
  });

  it('should return false for comment-only changes', () => {
    const diffs = [
      `+ // this is a comment`,
      `- // old comment`,
      `+ # python comment`,
      `+ /* block comment */`,
    ];
    diffs.forEach(d => {
      expect(isChangeSignificant(d)).toBe(false);
    });
  });

  it('should return true for actual code changes', () => {
    const diff = `
--- a/file.js
+++ b/file.js
@@ -1,1 +1,1 @@
-const x = 1;
+const x = 2;
    `;
    expect(isChangeSignificant(diff)).toBe(true);
  });

  it('should return false for empty or null diffs', () => {
    expect(isChangeSignificant('')).toBe(false);
  });
});
