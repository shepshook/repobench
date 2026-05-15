import simpleGit, { SimpleGit, LogOptions } from 'simple-git';
import crypto from 'node:crypto';
import { IMiner, Candidate } from '../contracts.js';
import { RepoBenchConfig } from '../config.js';

interface GitLogEntry {
  hash: string;
  message: string;
  body: string;
  author_name: string;
  author_email: string;
  date: string;
}

export class GitMiner implements IMiner {
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

        if (!shouldKeep) continue;

        candidates.push({
          id: crypto.randomUUID(),
          hash: commit.hash,
          message: commit.message,
          files,
          status: 'pending',
          created_at: new Date(),
        });
      } catch (error: unknown) {
        console.error(`Failed to retrieve files for commit ${commit.hash}: ${error instanceof Error ? error.message : String(error)}`);
        // Skip this commit and continue
      }
    }

    return candidates;
  }
}
