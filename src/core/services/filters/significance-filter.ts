import simpleGit, { SimpleGit } from 'simple-git';
import { ISignificanceFilter } from '../../contracts.js';

const NON_CODE_EXTENSIONS = ['.md', '.txt', '.json', '.yml', '.yaml', '.lock', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico'];

function collapse(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) {
    return '';
  }
  return line
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/#.*$/, '')
    .replace(/\s+/g, '');
}

export class BasicSignificanceFilter implements ISignificanceFilter {
  async isSignificant(git: SimpleGit, hash: string, files: string[]): Promise<boolean> {
    if (files.length > 5) return false;
    
    try {

      let stdDiff: string;
      let wDiff: string;
      try {
        stdDiff = await git.diff([`${hash}^`, hash]);
        wDiff = await git.diff(['-w', '-b', `${hash}^`, hash]);
      } catch (error: any) {
        if (error.message.includes('unknown revision') || error.message.includes('ambiguous argument')) {
          return true;
        }
        throw error;
      }
      if (!stdDiff) return false;
      
      const diffLines = stdDiff.split('\n');
      const actualFilesCount = diffLines.filter(line => line.startsWith('diff --git')).length;
      if (actualFilesCount > 5) return false;
      
      let totalLinesChanged = 0;
      for (const line of diffLines) {
        if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
          totalLinesChanged++;
        } else if (line.startsWith('@@')) {
          const match = line.match(/@@ -\d+,(\d+) \+\d+,(\d+) @@/);
          if (match) {
            const oldLines = parseInt(match[1]);
            const newLines = parseInt(match[2]);
            if (oldLines > 50 || newLines > 50) return false;
          }
        }
      }
      if (totalLinesChanged > 50) return false;
      
      if (!wDiff) return false;
      
      const lines = wDiff.split('\n');
      let currentFile = '';
      let significantLineFound = false;
      let hunkOld = '';
      let hunkNew = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('diff --git')) {
          if (this.checkSignificance(currentFile, hunkOld, hunkNew)) {
            significantLineFound = true;
            break;
          }
          const match = line.match(/a\/([^ ]+)/);
          currentFile = match ? match[1] : '';
          hunkOld = '';
          hunkNew = '';
          continue;
        }
        
        if (line.startsWith('@@')) {
          if (this.checkSignificance(currentFile, hunkOld, hunkNew)) {
            significantLineFound = true;
            break;
          }
          hunkOld = '';
          hunkNew = '';
          continue;
        }
        
        if (line.startsWith('+') && !line.startsWith('+++')) {
          hunkNew += collapse(line.slice(1));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          hunkOld += collapse(line.slice(1));
        }
      }

      if (!significantLineFound && this.checkSignificance(currentFile, hunkOld, hunkNew)) {
        significantLineFound = true;
      }

      return significantLineFound;
    } catch (error: unknown) {
      throw new Error(`Significance filter failed for hash ${hash}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private checkSignificance(currentFile: string, hunkOld: string, hunkNew: string): boolean {
    if (currentFile && !NON_CODE_EXTENSIONS.some(ext => currentFile.endsWith(ext))) {
      return hunkOld !== hunkNew;
    }
    return false;
  }
}
