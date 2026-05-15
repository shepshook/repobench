import simpleGit from 'simple-git';
import { ISignificanceFilter } from '../../contracts.js';

const NON_CODE_EXTENSIONS = ['.md', '.txt', '.json', '.yml', '.yaml'];

export class BasicSignificanceFilter implements ISignificanceFilter {
  async isSignificant(hash: string, files: string[]): Promise<boolean> {
    const git = simpleGit();
    
    try {
      const stdDiff = await git.diff([`${hash}^`, hash]);
      const wDiff = await git.diff(['-w', `${hash}^`, hash]);
      
      if (!stdDiff) return false;
      if (!wDiff) {
        // stdDiff is non-empty but wDiff is empty -> Whitespace only
        return false;
      }

      const lines = wDiff.split('\n');
      let currentFile = '';
      let significantLineFound = false;

      for (const line of lines) {
        // Track current file from diff header
        if (line.startsWith('diff --git')) {
          const match = line.match(/a\/([^ ]+)/);
          currentFile = match ? match[1] : '';
          continue;
        }

        // Only process added/removed lines, ignoring diff headers
        if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('---') && !line.startsWith('+++')) {
          const content = line.slice(1).trim();
          
          // 1. Non-code file check
          if (currentFile && NON_CODE_EXTENSIONS.some(ext => currentFile.endsWith(ext))) {
            continue;
          }
          
          // 2. Comment detection for JS/TS
          if (!content || content.startsWith('//') || content.startsWith('/*') || content.startsWith('*')) {
            continue;
          }
          
          // If we reach here, we found a line that is not whitespace, not a comment, and not in a non-code file
          significantLineFound = true;
          break;
        }
      }

      return significantLineFound;
    } catch (error: unknown) {
      console.error(`Significance filter error for ${hash}: ${error}`);
      return false;
    }
  }
}

