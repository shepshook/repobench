import simpleGit, { SimpleGit, LogOptions } from 'simple-git';
import crypto from 'node:crypto';
import { IMiner, Candidate, ISignificanceFilter, ICandidateRepository, ICurationService } from '../contracts.js';
import { RepoBenchConfig } from '../config.js';
import { BasicSignificanceFilter } from './filters/significance-filter.js';
import { NoOpCurationService } from './curation-service.js';

interface GitLogEntry {
  hash: string;
  message: string;
  body: string;
  author_name: string;
  author_email: string;
  date: string;
}

export class GitMiner implements IMiner {
  constructor(
    private repository: ICandidateRepository,
    private significanceFilter: ISignificanceFilter = new BasicSignificanceFilter(),
    private curationService: ICurationService = new NoOpCurationService()
  ) {}

  async mineCommits(config: RepoBenchConfig): Promise<Candidate[]> {
    const git: SimpleGit = simpleGit();
    
    const logOptions: LogOptions = {};
    if (config.mining.limit) {
      logOptions.maxCount = config.mining.limit;
    }
    if (config.mining.since) {
      logOptions.from = config.mining.since;
    }

    let commits: GitLogEntry[];
    try {
      const logResult = await git.log(logOptions);
      commits = (logResult as any).all || [];
    } catch (error: unknown) {
      throw new Error(`Failed to fetch git log: ${error instanceof Error ? error.message : String(error)}`);
    }

    
    const candidates: Candidate[] = [];
    
    // Process commits sequentially to avoid process exhaustion (EMFILE)
    for (const commit of commits) {
        if (this.repository.exists(commit.hash)) continue;

        try {
          const filesContent = await git.show(['--format=', '--name-only', commit.hash]);
          const files = filesContent
            .split('\n')
            .map((f: string) => f.trim())
            .filter((f: string) => f.length > 0);


        // Filtering logic
        let shouldKeep = true;

        // Keyword Filter
        if (config.mining.keywords.length > 0) {
          const messageLower = commit.message.toLowerCase();
          shouldKeep = config.mining.keywords.some(kw => 
            messageLower.includes(kw.toLowerCase())
          );
        }

        // Path Filter (only check if still potentially kept)
        if (shouldKeep && config.mining.exclude_paths.length > 0) {
          const allFilesExcluded = files.every(file => 
            config.mining.exclude_paths.some(path => {
              const normalizedPath = path.endsWith('/') ? path : `${path}/`;
              return file.startsWith(normalizedPath) || file === path;
            })
          );
          if (allFilesExcluded) {
            shouldKeep = false;
          }
        }

        // Significance Filter
        if (shouldKeep) {
          shouldKeep = await this.significanceFilter.isSignificant(git, commit.hash, files);
        }

        if (!shouldKeep) continue;

        const candidate: Candidate = {
          id: crypto.randomUUID(),
          hash: commit.hash,
          message: commit.message,
          files,
          status: 'pending',
          created_at: new Date(),
        };

        // Curation
        // NOTE: This is a synchronous, blocking operation. For large commit histories, 
        // this will significantly increase the total mining time.
        const startTime = Date.now();
        const curationResult = await this.curationService.curate(candidate);
        const latency = Date.now() - startTime;

        console.log(`Curation for ${commit.hash}: ${curationResult.isApproved ? 'Approved' : 'Rejected'} (Latency: ${latency}ms)`);
        console.log(`Reasoning: ${curationResult.reasoning}`);
        console.log(`Raw Response: ${curationResult.rawResponse}`);

        if (!curationResult.isApproved) continue;

        this.repository.save(candidate);
        candidates.push(candidate);
      } catch (error: unknown) {
        console.error(`Failed to retrieve files for commit ${commit.hash}: ${error instanceof Error ? error.message : String(error)}`);
        // Skip this commit and continue
      }
    }

    return candidates;
  }
}
