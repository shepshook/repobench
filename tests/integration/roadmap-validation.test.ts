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

describe('ROADMAP.md Epic 2 Success Criteria (Task 2.FIX1.3)', () => {
  const roadmapPath = path.resolve(process.cwd(), '.agents', 'ROADMAP.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(roadmapPath, 'utf-8');
  });

  it('should mark "Full Docker isolation with state reproduction via git and build_command" as completed', () => {
    expect(content).toContain('- [x] Full Docker isolation with state reproduction via git and `build_command`.');
  });

  it('should mark "Automated resource teardown" as completed', () => {
    expect(content).toContain('- [x] Automated resource teardown.');
  });
});
