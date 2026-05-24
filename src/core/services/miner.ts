import simpleGit, { SimpleGit } from 'simple-git';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { IMiner, Candidate, ISignificanceFilter, ICandidateRepository, ICurationService, IBenchmarkValidator } from '../contracts.js';
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
    private curationService: ICurationService = new NoOpCurationService(),
    private validator?: IBenchmarkValidator
  ) {}

  async mineCommits(config: RepoBenchConfig): Promise<Candidate[]> {
    const git: SimpleGit = simpleGit();
    
    let repositoryUrl = 'https://github.com/unknown/unknown';
    let repositoryName = path.basename(process.cwd());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if (typeof (git as any).getConfig === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const rawUrl = await (git as any).getConfig('remote.origin.url');
        if (typeof rawUrl === 'string') {
          repositoryUrl = rawUrl;
          repositoryName = rawUrl.split('/').pop()?.replace('.git', '') || repositoryName;
        }
      } catch (error: unknown) {
        console.warn(`Miner: Could not determine remote origin URL (${error instanceof Error ? error.message : String(error)}), using defaults`);
      }
    }
    
    const args: string[] = ['log', '--format=%H|%ai|%s', '--reverse'];
    if (config.mining.since) {
      args.push(`--since=${config.mining.since}`);
    }
    if (config.mining.limit) {
      args.push(`--max-count=${config.mining.limit}`);
    }

    let commits: GitLogEntry[];
    try {
      const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = execFile('git', args, { cwd: process.cwd(), encoding: 'utf8' }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Failed to fetch git log: ${error.message}\n${stderr}`));
          } else {
            resolve({ stdout, stderr });
          }
        });
        const timer = setTimeout(() => { child.kill(); reject(new Error('git log timed out')); }, 30_000);
        child.on('close', () => clearTimeout(timer));
      });
      commits = stdout.trim().split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          const parts = line.split('|');
          return {
            hash: parts[0],
            date: parts[1] || '',
            message: parts.slice(2).join('|'),
            body: '',
            author_name: '',
            author_email: '',
          };
        });
    } catch (error: unknown) {
      throw new Error(`Failed to fetch git log: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
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

        // Retrieve parent commit hash for preFixHash
        let preFixHash: string | undefined;
        try {
          const parentResult = await git.raw(['rev-parse', `${commit.hash}^`]);
          preFixHash = parentResult.trim();
        } catch (error: unknown) {
          console.warn(`Miner: Could not resolve parent commit for ${commit.hash} (${error instanceof Error ? error.message : String(error)}), preFixHash will be undefined`);
          preFixHash = undefined;
        }

        const candidate: Candidate = {
          id: crypto.randomUUID(),
          hash: commit.hash,
          message: commit.message,
          files,
          status: 'pending',
          created_at: new Date(),
          repositoryUrl,
          repositoryName,
          postFixHash: commit.hash,
          preFixHash,
          author_name: commit.author_name,
          author_email: commit.author_email,
          body: commit.body,
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

        if (this.validator) {
          try {
            const validationResult = await this.validator.validate(candidate);
            candidate.status = validationResult.isValid ? 'validated' : 'rejected';

            if (validationResult.isValid) {
              console.log(`Candidate ${candidate.hash} VALIDATED: Pre-fail, Post-pass (Latency: ${validationResult.latency}ms)`);
            } else {
              if (validationResult.preFixStatus === 'pass') {
                console.log(`Candidate ${candidate.hash} REJECTED: Pre-pass (already fixed or not a bug) (Latency: ${validationResult.latency}ms)`);
                console.log(`Pre-fix output: ${validationResult.preFixOutput}`);
              } else if (validationResult.postFixStatus === 'fail') {
                console.log(`Candidate ${candidate.hash} REJECTED: Post-fail (fix did not work) (Latency: ${validationResult.latency}ms)`);
                console.log(`Post-fix output: ${validationResult.postFixOutput}`);
              } else if (validationResult.preFixStatus === 'error' || validationResult.postFixStatus === 'error') {
                console.log(`Candidate ${candidate.hash} REJECTED: Sandbox error during validation (Latency: ${validationResult.latency}ms)`);
                if (validationResult.preFixStatus === 'error') console.log(`Pre-fix output: ${validationResult.preFixOutput}`);
                if (validationResult.postFixStatus === 'error') console.log(`Post-fix output: ${validationResult.postFixOutput}`);
              }
            }
          } catch (error: unknown) {
            candidate.status = 'rejected';
            console.log(`Candidate ${candidate.hash} REJECTED: Sandbox error during validation`);
            console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        this.repository.upsert(candidate);
        candidates.push(candidate);
      } catch (error: unknown) {
        console.error(`Failed to retrieve files for commit ${commit.hash}: ${error instanceof Error ? error.message : String(error)}`);
        // Skip this commit and continue
      }
    }

    return candidates;
  }
}
