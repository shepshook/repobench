import simpleGit, { SimpleGit } from 'simple-git';
import { z } from 'zod';

export const CommitCandidateSchema = z.object({
  hash: z.string(),
  message: z.string(),
  files: z.array(z.string()),
});

export type CommitCandidate = z.infer<typeof CommitCandidateSchema>;

export class Miner {
  private git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
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

    for (const log of logs.all) {
      if (/fix|bug/i.test(log.message)) {
        const files = await this.git.show(['--name-only', '--pretty=format:', log.hash]);
        const fileList = files.split('\n').filter((f: string) => f.trim());
        
        const hasSource = fileList.some(this.isSourceFile);
        const hasTest = fileList.some(this.isTestFile);

        if (hasSource && hasTest) {
          candidates.push({
            hash: log.hash,
            message: log.message,
            files: fileList,
          });
        }
      }
    }

    return candidates;
  }
}
