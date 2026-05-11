import { LLMClient } from '../llm/client';
import { ICandidateRepository, CommitCandidate } from '../../types/contracts';
import { SimpleGit } from 'simple-git';

const DEFAULT_BATCH_SIZE = 20;
const MAX_FILES_PER_SUMMARY = 3;
const MAX_DIFF_LENGTH = 500;

export class CurationService {
  constructor(
    private llmClient: LLMClient,
    private repo: ICandidateRepository,
    private git: SimpleGit
  ) {}

  async curate(limit: number): Promise<CommitCandidate[]> {
    const pending = await this.repo.findByStatus('pending');
    if (pending.length === 0) {
      return [];
    }

    const validatedHashes = new Set<string>();
    const rejectedHashes = new Set<string>();

    for (let i = 0; i < pending.length; i += DEFAULT_BATCH_SIZE) {
      const batch = pending.slice(i, i + DEFAULT_BATCH_SIZE);
      const remainingLimit = limit - validatedHashes.size;
      
      if (remainingLimit <= 0) {
        break;
      }

      const summaries = await this.generateSummaries(batch);
      const selectedInBatch = await this.processBatch(summaries, remainingLimit);
      
      selectedInBatch.slice(0, remainingLimit).forEach(hash => validatedHashes.add(hash));
      
      if (selectedInBatch.length > 0 || summaries.length > 0) {
        batch.forEach(c => {
          if (!validatedHashes.has(c.hash)) {
            rejectedHashes.add(c.hash);
          }
        });
      }
      
      if (validatedHashes.size >= limit) break;
    }

    const updates = [
      ...Array.from(validatedHashes).map(hash => ({ hash, status: 'validated' as const })),
      ...Array.from(rejectedHashes).map(hash => ({ hash, status: 'rejected' as const })),
    ];

    await this.repo.updateStatuses(updates);

    return this.repo.findByHashes(Array.from(validatedHashes));
  }

  private async generateSummaries(batch: CommitCandidate[]): Promise<{hash: string, summary: string}[]> {
    const summaries = [];
    for (const c of batch) {
      try {
        const diffs = await Promise.all(
          c.files.slice(0, MAX_FILES_PER_SUMMARY).map(async file => {
            const diff = await this.git.show([`--unified=1`, c.hash, `--`, file]);
            return `File ${file}:\n${diff.slice(0, MAX_DIFF_LENGTH)}`;
          })
        );
        summaries.push({
          hash: c.hash,
          summary: `Message: ${c.message}\nFiles: ${c.files.join(', ')}\nDiffs:\n${diffs.join('\n\n')}`
        });
      } catch (e) {
        summaries.push({
          hash: c.hash,
          summary: `Message: ${c.message}\nFiles: ${c.files.join(', ')}\n(Diff failed to load)`
        });
      }
    }
    return summaries;
  }

  private async processBatch(summaries: {hash: string, summary: string}[], limit: number): Promise<string[]> {
    const systemPrompt = `You are an expert software engineer. Your task is to select the most high-value bug-fix candidates for a coding benchmark.
A high-value candidate must meet the following rubric:
1. High Complexity: The fix involves non-trivial logic changes, not just typos, comments, or simple variable renames.
2. Representativeness: The fix addresses a common or critical bug pattern that would be a good test for an AI agent.
3. Clear Structure: There is a clear separation between the source code fix and the corresponding test change.

Return ONLY a JSON array of hashes for the top candidates you select. Max limit: ${limit}.
Example output: ["hash1", "hash2"]`;

    const userPrompt = `Here are the candidates:\n${summaries.map(s => `Hash: ${s.hash}\nSummary:\n${s.summary}`).join('\n\n---\n\n')}`;

    try {
      const response = await this.llmClient.chat(systemPrompt, userPrompt);
      const cleanedResponse = response.trim().replace(/```json|```/g, '');
      const hashes = JSON.parse(cleanedResponse) as string[];
      return hashes.filter(hash => summaries.some(s => s.hash === hash));
    } catch (e) {
      console.error('Failed to parse LLM response during curation:', e);
      return [];
    }
  }
}
