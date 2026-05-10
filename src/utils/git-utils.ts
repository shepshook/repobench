export function isChangeSignificant(diff: string): boolean {
  if (!diff) return false;

  const lines = diff.split('\n');
  const significantLines = lines.filter(line => {
    const trimmed = line.trim();
    
    // Ignore empty lines
    if (!trimmed) return false;
    
    // Ignore git metadata lines
    if (trimmed.startsWith('diff --git') || 
        trimmed.startsWith('index ') || 
        trimmed.startsWith('---') || 
        trimmed.startsWith('+++')) {
      return false;
    }

    // We only care about added or removed lines
    if (!trimmed.startsWith('+') && !trimmed.startsWith('-')) {
      return false;
    }

    // Remove the +/- prefix for analysis
    const content = trimmed.slice(1).trim();
    if (!content) return false;

    // Ignore whitespace-only changes (handled by trim)
    
    // Ignore comment-only changes
    // JS/TS/C/Java/Go/Rust: // or /*
    // Python/Ruby/Shell: #
    if (/^(\/\/|#|\/\*|\*)/.test(content)) {
      return false;
    }

    return true;
  });

  return significantLines.length > 0;
}
