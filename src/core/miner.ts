import simpleGit, { SimpleGit } from 'simple-git';
import { z } from 'zod';
import { Config, RepoBenchConfig } from './config';

export const CommitCandidateSchema = z.object({
  hash: z.string(),
  message: z.string(),
  files: z.array(z.string()),
});

export type CommitCandidate = z.infer<typeof CommitCandidateSchema>;

export class Miner {
  private git: SimpleGit;
  private config: RepoBenchConfig;

  constructor(repoPath: string, config: RepoBenchConfig) {
    this.git = simpleGit(repoPath);
    this.config = config;
  }

  private isSourceFile(file: string): boolean {
    return /\.(ts|js|py|cpp|c|go|rs|java)$/.test(file);
  }

  private isTestFile(file: string): boolean {
    return /(.test\.|.spec\.|tests\/|test\/)/.test(file);
  }

  async mineCommits(): Promise<CommitCandidate[]> {
    console.log('Mining git log for potential bug fixes...');
    
    const logs = await this.git.log();
    const candidates: CommitCandidate[] = [];

    const keywords = this.config.mining.keywords;
    const keywordRegex = keywords.length > 0 
      ? new RegExp(keywords.join('|'), 'i') 
      : null;

    for (const log of logs.all) {
      if (keywordRegex && !keywordRegex.test(log.message)) {
        continue;
      }
      if (!keywordRegex) continue;

      const files = await this.git.show(['--name-only', '--pretty=format:', log.hash]);
      const allFiles = files.split('\n').filter((f: string) => f.trim());
      
      // Filter out excluded paths
      const filteredFiles = allFiles.filter(file => {
        return !this.config.mining.exclude_paths.some(pattern => file.startsWith(pattern));
      });
      
      const hasSource = filteredFiles.some(this.isSourceFile);
      const hasTest = filteredFiles.some(this.isTestFile);

      if (hasSource && hasTest) {
        candidates.push({
          hash: log.hash,
          message: log.message,
          files: filteredFiles,
        });
      }
    }

    return candidates;
  }
}

