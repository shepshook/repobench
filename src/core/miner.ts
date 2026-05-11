import simpleGit, { SimpleGit } from 'simple-git';
import { z } from 'zod';
import { Config, RepoBenchConfig } from './config.js';
import { isChangeSignificant } from '../utils/git-utils.js';
import { ICandidateRepository, CommitCandidate } from '../types/contracts.js';
import { CurationService } from './curation/service';

export const CommitCandidateSchema = z.object({
  hash: z.string(),
  message: z.string(),
  files: z.array(z.string()),
  status: z.enum(['pending', 'validated', 'rejected']).default('pending'),
  metadata: z.record(z.any()).optional().default({}),
});

export class Miner {
  private git: SimpleGit;
  private config: RepoBenchConfig;
  private repo: ICandidateRepository;
  private curationService: CurationService;

  constructor(repoPath: string, config: RepoBenchConfig, repo: ICandidateRepository, curationService: CurationService) {
    this.git = simpleGit(repoPath);
    this.config = config;
    this.repo = repo;
    this.curationService = curationService;
  }

  private isSourceFile(file: string): boolean {
    const extensions = this.config.mining.source_extensions;
    return new RegExp(`\\.(${extensions.join('|')})$`).test(file);
  }

  private isTestFile(file: string): boolean {
    return /(.test\.|.spec\.|tests\/|test\/)/.test(file);
  }

  async mineCommits(): Promise<CommitCandidate[]> {
    const cached = await this.repo.findAll();
    const cachedHashes = new Set(cached.map(c => c.hash));

    console.log('Mining git log for potential bug fixes...');
    
    const logs = await this.git.log();
    const newCandidates: CommitCandidate[] = [];

    const keywords = this.config.mining.keywords;
    const keywordRegex = keywords.length > 0 
      ? new RegExp(keywords.join('|'), 'i') 
      : null;

    for (const log of logs.all) {
      if (cachedHashes.has(log.hash)) {
        continue;
      }

      if (keywordRegex && !keywordRegex.test(log.message)) {
        continue;
      }

      const files = await this.git.show(['--name-only', '--pretty=format:', log.hash]);
      const allFiles = files.split('\n').filter((f: string) => f.trim());
      
      const filteredFiles = allFiles.filter(file => {
        return !this.config.mining.exclude_paths.some(pattern => file.startsWith(pattern));
      });
      
      const hasSource = filteredFiles.some(file => this.isSourceFile(file));
      const hasTest = filteredFiles.some(file => this.isTestFile(file));

      if (hasSource && hasTest) {
        const sourceFile = filteredFiles.find(file => this.isSourceFile(file));
        const testFile = filteredFiles.find(file => this.isTestFile(file));

        if (sourceFile && testFile) {
          const sourceDiff = await this.git.show([`--unified=0`, log.hash, `--`, sourceFile]);
          const testDiff = await this.git.show([`--unified=0`, log.hash, `--`, testFile]);
          
          if (!isChangeSignificant(sourceDiff) || !isChangeSignificant(testDiff)) {
            continue;
          }
        }

        newCandidates.push({
          hash: log.hash,
          message: log.message,
          files: filteredFiles,
          status: 'pending',
          metadata: {},
        });
      }
    }

    if (newCandidates.length > 0) {
      await this.repo.saveMany(newCandidates);
    }

    return [...cached, ...newCandidates];
  }

  async curateCandidates(candidates: CommitCandidate[], limit: number): Promise<CommitCandidate[]> {
    return this.curationService.curate(limit);
  }
}
