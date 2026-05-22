import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ROADMAP.md Epic 1 Success Criteria (Task 1.FIX1.1)', () => {
  const roadmapPath = path.resolve(process.cwd(), '.agents', 'ROADMAP.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(roadmapPath, 'utf-8');
  });

  it('should mark "Implement Pure Fix heuristics" as completed', () => {
    expect(content).toContain("- [x] Implement 'Pure Fix' heuristics.");
  });

  it('should mark "Filter out noise (refactors, docs)" as completed', () => {
    expect(content).toContain('- [x] Filter out noise (refactors, docs).');
  });

  it('should mark "Support repobench.yaml for keywords/exclusions" as completed', () => {
    expect(content).toContain('- [x] Support `repobench.yaml` for keywords/exclusions.');
  });

  it('should mark "Export candidates to structured format" as completed', () => {
    expect(content).toContain('- [x] Export candidates to structured format.');
  });

  it('should mark Feature 1.FIX1 as completed', () => {
    expect(content).toContain('* **[x] Feature 1.FIX1: Global Epic Integration & Alignment Round 1**');
  });
});
