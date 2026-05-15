import { vi, describe, it, expect } from 'vitest';
import { ISignificanceFilter } from '../../../src/core/contracts';
import simpleGit from 'simple-git';
import { BasicSignificanceFilter } from '../../../src/core/services/filters/significance-filter';

vi.mock('simple-git');

interface GoldenCase {
  name: string;
  diff: string;
  expected: boolean;
  category: 'noise' | 'impurity' | 'pure';
}

export const GoldenDataset: GoldenCase[] = [
  // --- Insignificant (Noise) ---
  {
    name: 'Pure Whitespace: Indentation change',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n-  console.log("hello");\n+    console.log("hello");\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Pure Whitespace: Trailing spaces',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 1;  \n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Comment Only: Single line //',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-// Old comment\n+// New comment\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Comment Only: Block /* */',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n-/*\n- * Old block\n- */\n+/*\n+ * New block\n+ */\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Comment Only: JSDoc update',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,2 +1,2 @@\n-/** Old doc */\n+/** Updated doc */\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Non-Code File: Markdown',
    diff: 'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-# Old Title\n+# New Title\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Non-Code File: Text',
    diff: 'diff --git a/notes.txt b/notes.txt\n--- a/notes.txt\n+++ b/notes.txt\n@@ -1,1 +1,1 @@\n-Old note\n+New note\n',
    expected: false,
    category: 'noise',
  },
  {
    name: 'Non-Code File: JSON',
    diff: 'diff --git a/data.json b/data.json\n--- a/data.json\n+++ b/data.json\n@@ -1,1 +1,1 @@\n-{"version": "1.0"}\n+{"version": "1.1"}\n',
    expected: false,
    category: 'noise',
  },
    {
      name: 'Lock File: package-lock.json',
      diff: 'diff --git a/package-lock.json b/package-lock.json\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1,1 +1,1 @@\n-  "version": "1.0.0",\n+  "version": "1.0.1",\n',
      expected: false,
      category: 'noise',
    },
    {
      name: 'Lock File: yarn.lock',
      diff: 'diff --git a/yarn.lock b/yarn.lock\n--- a/yarn.lock\n+++ b/yarn.lock\n@@ -1,1 +1,1 @@\n-some-pkg@1.0.0\n+some-pkg@1.0.1\n',
      expected: false,
      category: 'noise',
    },
    {
      name: 'Lock File: pnpm-lock.yaml',
      diff: 'diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\n--- a/pnpm-lock.yaml\n+++ b/pnpm-lock.yaml\n@@ -1,1 +1,1 @@\n-lockfileVersion: 5.0\n+lockfileVersion: 6.0\n',
      expected: false,
      category: 'noise',
    },
    {
      name: 'Asset: SVG',
      diff: 'diff --git a/logo.svg b/logo.svg\n--- a/logo.svg\n+++ b/logo.svg\n@@ -1,1 +1,1 @@\n-<circle cx="50" cy="50" r="40" />\n+<circle cx="50" cy="50" r="45" />\n',
      expected: false,
      category: 'noise',
    },
    {
      name: 'Asset: PNG (binary representation)',
      diff: 'diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ\n',
      expected: false,
      category: 'noise',
    },
    {
      name: 'Non-Code File: YAML config',
      diff: 'diff --git a/config.yaml b/config.yaml\n--- a/config.yaml\n+++ b/config.yaml\n@@ -1,1 +1,1 @@\n-timeout: 30\n+timeout: 60\n',
      expected: false,
      category: 'noise',
    },

  {
    name: 'Mixed Noise: Whitespace and Comments',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,2 +1,2 @@\n-  // comment\n+    // updated comment\n',
    expected: false,
    category: 'noise',
  },
  // --- Significant but Impure ---
  {
    name: 'Purity: High line count',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n' + '@@ -1,100 +1,100 @@\n'.repeat(10) + ' a lot of changes here\n',
    expected: false,
    category: 'impurity',
  },
  {
    name: 'Purity: High file count',
    diff: 'diff --git a/f1.ts b/f1.ts\n--- a/f1.ts\n+++ b/f1.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f2.ts b/f2.ts\n--- a/f2.ts\n+++ b/f2.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n'.repeat(11),
    expected: false,
    category: 'impurity',
  },
  {
    name: 'Mixed Intent: Feature and Fix',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2; // Fix\n@@ -10,1 +10,1 @@\n-function foo() {}\n+function foo() { console.log("new feature"); }\n',
    expected: true,
    category: 'impurity',
  },
  // --- Significant and Pure ---
  {
    name: 'Purity: Pure Fix (1-2 files, < 10 lines)',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-const x = 1;\n+const x = 2;\n' + 'diff --git a/src/utils.ts b/src/utils.ts\n--- a/src/utils.ts\n+++ b/src/utils.ts\n@@ -1,1 +1,1 @@\n-export const a = 1;\n+export const a = 2;\n',
    expected: true,
    category: 'pure',
  },
  {
    name: 'Minimal Logic Fix: Operator change',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-if (x > 0)\n+if (x >= 0)\n',
    expected: true,
    category: 'pure',
  },
  {
    name: 'Minimal Logic Fix: Variable rename',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-return user.name;\n+return user.fullName;\n',
    expected: true,
    category: 'pure',
  },
    {
      name: 'Impurity: High file count (>5)',
      diff: 'diff --git a/f1.ts b/f1.ts\n--- a/f1.ts\n+++ b/f1.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f2.ts b/f2.ts\n--- a/f2.ts\n+++ b/f2.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f3.ts b/f3.ts\n--- a/f3.ts\n+++ b/f3.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f4.ts b/f4.ts\n--- a/f4.ts\n+++ b/f4.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f5.ts b/f5.ts\n--- a/f5.ts\n+++ b/f5.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n' + 'diff --git a/f6.ts b/f6.ts\n--- a/f6.ts\n+++ b/f6.ts\n@@ -1,1 +1,1 @@\n-x\n+y\n',
      expected: false,
      category: 'impurity',
    },
    {
      name: 'Impurity: High line count (>50)',
      diff: 'diff --git a/big.ts b/big.ts\n--- a/big.ts\n+++ b/big.ts\n' + '@@ -1,51 +1,51 @@\n'.repeat(1) + '+const x = 1;\n'.repeat(51),
      expected: false,
      category: 'impurity',
    },
    {
      name: 'Pure Fix: Small change',
      diff: 'diff --git a/app.ts b/app.ts\n--- a/app.ts\n+++ b/app.ts\n@@ -1,1 +1,1 @@\n-if (a > b)\n+if (a >= b)\n',
      expected: true,
      category: 'pure',
    },

];

export async function runSignificanceValidation(filter: ISignificanceFilter, dataset: GoldenCase[]) {
  let passed = 0;
  const failures: string[] = [];

  for (const caso of dataset) {
    // Mock simple-git behavior for this specific case
    (simpleGit as any).mockImplementation(() => ({
      diff: vi.fn()
        .mockResolvedValueOnce(caso.diff) // First call: stdDiff
        .mockResolvedValueOnce(
          caso.category === 'noise' && caso.name.includes('Whitespace') 
            ? '' 
            : caso.diff
        ), // Second call: wDiff (simulates -w flag)
    }));

    const result = await filter.isSignificant('mock-hash', ['mock-file.ts']);
    
    if (result === caso.expected) {
      passed++;
    } else {
      failures.push(`${caso.name} (Expected ${caso.expected}, got ${result})`);
    }
  }

  return {
    total: dataset.length,
    passed,
    failed: dataset.length - passed,
    failures,
    accuracy: (passed / dataset.length) * 100,
  };
}

describe('Significance Filter Validation', () => {
  it('should correctly classify all cases in the golden dataset', async () => {
    const filter = new BasicSignificanceFilter();
    const summary = await runSignificanceValidation(filter, GoldenDataset);
    
    console.log('Significance Filter Summary:', summary);
    
    if (summary.failed > 0) {
      console.error('Failures:\n' + summary.failures.join('\n'));
    }
    
    expect(summary.failed).toBe(0);
  });
});
