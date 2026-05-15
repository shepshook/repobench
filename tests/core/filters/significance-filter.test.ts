import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BasicSignificanceFilter } from '../../../src/core/services/filters/significance-filter';
import simpleGit from 'simple-git';

vi.mock('simple-git');

describe('BasicSignificanceFilter', () => {
  let filter: BasicSignificanceFilter;
  const mockGit = {
    diff: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (simpleGit as any).mockReturnValue(mockGit);
    filter = new BasicSignificanceFilter();
  });

    it('should return true for commits with actual code changes', async () => {
      mockGit.diff.mockImplementation((args) => {
        if (args.includes('-w')) {
          return Promise.resolve('--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const a = 1;\n+const a = 2;');
        }
        return Promise.resolve('--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const a = 1;\n+const a = 2;');
      });
      const result = await filter.isSignificant('hash1', ['src/index.ts']);
      expect(result).toBe(true);
    });

    it('should return false for commits with only whitespace changes', async () => {
      mockGit.diff.mockImplementation((args) => {
        if (args.includes('-w')) {
          return Promise.resolve('');
        }
        return Promise.resolve('--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const a = 1;\n+  const a = 1;');
      });
      const result = await filter.isSignificant('hash2', ['src/index.ts']);
      expect(result).toBe(false);
    });

    it('should return false for commits with only comment changes', async () => {
      const diff = 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-// Old comment\n+// New comment';
      mockGit.diff.mockImplementation((args) => {
        return Promise.resolve(args.includes('-w') ? diff : diff);
      });
      const result = await filter.isSignificant('hash3', ['src/index.ts']);
      expect(result).toBe(false);
    });

    it('should return false for commits with only non-code file changes', async () => {
      const diff = 'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-Old README\n+New README';
      mockGit.diff.mockImplementation((args) => {
        return Promise.resolve(args.includes('-w') ? diff : diff);
      });
      const result = await filter.isSignificant('hash4', ['README.md']);
      expect(result).toBe(false);
    });

    it('should return true for mixed commits with at least one significant change', async () => {
      const diff = 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const a = 1;\n+const a = 2;\n' +
                   'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-Old\n+New';
      mockGit.diff.mockImplementation((args) => {
        return Promise.resolve(diff);
      });
      const result = await filter.isSignificant('hash5', ['src/index.ts', 'README.md']);
      expect(result).toBe(true);
    });

    it('should return false for mixed commits with only insignificant changes', async () => {
      const diff = 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-// Old comment\n+// New comment\n' +
                   'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-Old\n+New';
      mockGit.diff.mockImplementation((args) => {
        return Promise.resolve(diff);
      });
      const result = await filter.isSignificant('hash6', ['src/index.ts', 'README.md']);
      expect(result).toBe(false);
    });

});
