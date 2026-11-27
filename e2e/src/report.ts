import path from 'node:path';
import { privateWrite } from './private-files.js';
import { reportFile, safeText } from './policy.js';
import type { Report } from './model.js';
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}
export function reportHtml(report: Report): string {
  // Only the curated report is rendered; never embed DOM, traces, logs, URLs or cookies.
  const json = JSON.stringify(report, null, 2);
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Light House DEVELOPMENT acceptance</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}td,th{border:1px solid #aaa;padding:.5rem}table{border-collapse:collapse}</style><h1>Light House DEVELOPMENT acceptance</h1><p>UI suite outcome: ' +
    escapeHtml(report.outcome) +
    '</p><p>Hosted correlation candidates are labelled separately from displayed UUID matches. UI success and deployment do not alone confirm the LIMIT diagnosis.</p><table><thead><tr><th>Operation</th><th>Inventory</th><th>UTC start</th><th>Duration ms</th><th>Outcome</th><th>Displayed rows</th><th>Correlation basis</th></tr></thead><tbody>' +
    report.operations
      .map(
        (op, index) =>
          '<tr>' +
          [
            op.operation,
            op.inventoryType ?? '',
            op.startedAt,
            String(op.durationMs),
            op.outcome,
            op.displayedRowCount === null
              ? 'not applicable/not captured'
              : String(op.displayedRowCount),
            report.logs.matches.find((match) => match.operationIndex === index)
              ?.basis ?? 'unmatched',
          ]
            .map((text) => '<td>' + escapeHtml(safeText(text)) + '</td>')
            .join('') +
          '</tr>',
      )
      .join('') +
    '</tbody></table><h2>Sanitised evidence</h2><pre>' +
    escapeHtml(json) +
    '</pre></html>'
  );
}
export async function writeReport(report: Report): Promise<void> {
  await privateWrite(reportFile, JSON.stringify(report, null, 2) + '\n');
  await privateWrite(
    path.join(path.dirname(reportFile), 'acceptance.html'),
    reportHtml(report),
  );
}
export function summary(report: Report): string {
  return [
    'Light House DEVELOPMENT UI suite: ' + report.outcome,
    ...report.operations.map(
      (op, index) =>
        `${op.operation}${op.inventoryType ? '/' + op.inventoryType + '/page-' + op.page : ''}: ${op.outcome}; rows=${op.displayedRowCount ?? 'n/a'}; ms=${op.durationMs}; correlation=${report.logs.matches.find((match) => match.operationIndex === index)?.basis ?? 'unmatched'}${op.error ? '; ' + op.error : ''}`,
    ),
    `Hosted logs: ${report.logs.status}. Reports: e2e/.local/reports/acceptance.{json,html}`,
  ].join('\n');
}
