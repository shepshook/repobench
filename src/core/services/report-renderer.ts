import type { LeaderboardEntry, IReportRenderer } from '../contracts';

const MIN_COLUMNS = 80;

const COLUMN_HEADERS = ['Rank', 'Agent ID', 'Runs', 'Passed', 'Failed', 'Success Rate', 'Avg E-Score', 'Avg Cost', 'Avg Latency'];

export class TerminalReportRenderer implements IReportRenderer {
  render(entries: LeaderboardEntry[]): string {
    if (entries.length === 0) return 'No data available.';

    if (!this.canUseCustomTable()) {
      console.table(entries);
      return this.formatAsConsoleTable(entries);
    }

    const rows = entries.map(e => this.formatRow(e));

    const colWidths = COLUMN_HEADERS.map((h, i) =>
      Math.max(h.length, ...rows.map(r => r[i].length)),
    );

    const headerLine = COLUMN_HEADERS.map((h, i) => h.padEnd(colWidths[i])).join(' | ');

    const separatorLine = colWidths.map(w => '─'.repeat(w)).join('┼');

    const dataLines = rows.map(row =>
      row.map((cell, i) => {
        if (i === 1) return cell.padEnd(colWidths[i]);
        return cell.padStart(colWidths[i]);
      }).join(' | '),
    );

    return [headerLine, separatorLine, ...dataLines].join('\n');
  }

  private canUseCustomTable(): boolean {
    const columns = (process.stdout as { columns?: number }).columns;
    return typeof columns === 'number' && columns >= MIN_COLUMNS;
  }

  private formatRow(e: LeaderboardEntry): string[] {
    return [
      String(e.rank),
      e.agentId,
      String(e.totalRuns),
      String(e.successfulRuns),
      String(e.failedRuns),
      `${(e.successRate * 100).toFixed(2)}%`,
      e.avgEScore.toFixed(3),
      `$${e.avgCost.toFixed(2)}`,
      `${e.avgLatency.toFixed(1)}s`,
    ];
  }

  private formatAsConsoleTable(entries: LeaderboardEntry[]): string {
    const formattedRows = entries.map(e => [
      String(e.rank),
      e.agentId,
      String(e.totalRuns),
      String(e.successfulRuns),
      String(e.failedRuns),
      `${(e.successRate * 100).toFixed(2)}%`,
      e.avgEScore.toFixed(3),
      `$${e.avgCost.toFixed(2)}`,
      `${e.avgLatency.toFixed(1)}s`,
    ]);

    const colWidths = COLUMN_HEADERS.map((h, i) =>
      Math.max(h.length, ...formattedRows.map(r => r[i].length)),
    );

    const topBorder = '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
    const headerRow = '│' + COLUMN_HEADERS.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│') + '│';
    const separator = '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
    const dataRows = formattedRows.map(row =>
      '│' + row.map((cell, i) => {
        if (i === 1) return ` ${cell.padEnd(colWidths[i])} `;
        return ` ${cell.padStart(colWidths[i])} `;
      }).join('│') + '│',
    );
    const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';

    return [topBorder, headerRow, separator, ...dataRows, bottomBorder].join('\n');
  }
}
