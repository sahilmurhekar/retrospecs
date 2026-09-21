import fs from "node:fs/promises";
import path from "node:path";
import type { ValidatedResult } from "../validators/statusValidator.js";
import { buildSummary, type RunSummary } from "./jsonReporter.js";

function escapeHtml(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pct(part: number, total: number): string {
  if (total === 0) return "0";
  return ((part / total) * 100).toFixed(1);
}

function renderBreakdownRow(label: string, breakdown: RunSummary["byOutcome"]["success"]): string {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${breakdown.total}</td>
      <td class="pass">${breakdown.passed}</td>
      <td class="fail">${breakdown.failed}</td>
      <td>${pct(breakdown.passed, breakdown.total)}%</td>
    </tr>`;
}

function renderFailureCard(result: ValidatedResult, index: number): string {
  const hasBody = result.responseBody !== undefined;
  return `
    <details class="failure-card">
      <summary>
        <span class="badge status-${result.status === 0 ? "err" : String(result.status)[0] + "xx"}">${
    result.status === 0 ? "ERR" : result.status
  }</span>
        <span class="failure-title">#${index + 1} — expected <strong>${escapeHtml(
    result.expectedOutcome
  )}</strong></span>
        <span class="latency">${result.latencyMs}ms</span>
      </summary>
      <div class="failure-body">
        <div class="failure-col">
          <h4>Params</h4>
          <pre>${escapeHtml(result.params)}</pre>
          <h4>Categories</h4>
          <pre>${escapeHtml(result.categories)}</pre>
        </div>
        <div class="failure-col">
          ${result.error ? `<h4>Error</h4><pre>${escapeHtml(result.error)}</pre>` : ""}
          ${hasBody ? `<h4>Response body</h4><pre>${escapeHtml(result.responseBody)}</pre>` : ""}
        </div>
      </div>
    </details>`;
}

function renderPage(endpointName: string, summary: RunSummary): string {
  const passRate = pct(summary.passed, summary.total);
  const failureCards = summary.unexpectedFailures.map(renderFailureCard).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>retrospecs report — ${escapeHtml(endpointName)}</title>
<style>
  :root {
    --bg: #f7f7f8;
    --surface: #ffffff;
    --border: #e2e2e6;
    --text: #1c1c1f;
    --muted: #6b6b74;
    --pass: #1a7f4b;
    --pass-bg: #e6f6ed;
    --fail: #b3261e;
    --fail-bg: #fdecea;
    --accent: #4f46e5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17171a;
      --surface: #201f24;
      --border: #33323a;
      --text: #ececef;
      --muted: #9c9ba5;
      --pass: #4ade80;
      --pass-bg: #123321;
      --fail: #f87171;
      --fail-bg: #3a1a1a;
      --accent: #818cf8;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px 64px;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 880px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .card .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
  .card.pass .value { color: var(--pass); }
  .card.fail .value { color: var(--fail); }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 32px; }
  th, td { text-align: left; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 500; }
  tr:last-child td { border-bottom: none; }
  td.pass { color: var(--pass); }
  td.fail { color: var(--fail); }
  h2 { font-size: 16px; margin: 0 0 12px; }
  .failure-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .failure-card summary {
    cursor: pointer;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    list-style: none;
  }
  .failure-card summary::-webkit-details-marker { display: none; }
  .failure-title { flex: 1; font-size: 13px; }
  .latency { font-size: 12px; color: var(--muted); }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .badge.status-4xx, .badge.status-5xx, .badge.status-err { color: var(--fail); background: var(--fail-bg); }
  .badge.status-2xx, .badge.status-3xx { color: var(--pass); background: var(--pass-bg); }
  .failure-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 0 14px 14px;
    border-top: 1px solid var(--border);
  }
  .failure-col h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 12px 0 4px; }
  pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    overflow-x: auto;
    margin: 0;
  }
  .empty { color: var(--muted); font-size: 13px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  @media (max-width: 560px) {
    .failure-body { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>retrospecs — ${escapeHtml(endpointName)}</h1>
    <div class="meta">seed <code>${escapeHtml(summary.seed)}</code> · ${summary.total} cases · avg latency ${
    summary.avgLatencyMs
  }ms</div>

    <div class="cards">
      <div class="card"><div class="label">Total</div><div class="value">${summary.total}</div></div>
      <div class="card pass"><div class="label">Passed</div><div class="value">${summary.passed}</div></div>
      <div class="card fail"><div class="label">Failed</div><div class="value">${summary.failed}</div></div>
      <div class="card"><div class="label">Pass rate</div><div class="value">${passRate}%</div></div>
    </div>

    <h2>By outcome</h2>
    <table>
      <thead><tr><th>Outcome</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass rate</th></tr></thead>
      <tbody>
        ${renderBreakdownRow("success (2xx expected)", summary.byOutcome.success)}
        ${renderBreakdownRow("rejection (4xx expected)", summary.byOutcome.rejection)}
      </tbody>
    </table>

    <h2>Unexpected failures (${summary.unexpectedFailures.length})</h2>
    ${
      summary.unexpectedFailures.length === 0
        ? `<div class="empty">No unexpected failures for this endpoint. 🎉</div>`
        : failureCards
    }
  </div>
</body>
</html>
`;
}

export async function writeHtmlReport(
  results: ValidatedResult[],
  outDir: string,
  seed: string,
  endpointName: string
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  const summary = buildSummary(results, seed);
  const html = renderPage(endpointName, summary);
  await fs.writeFile(path.join(outDir, "report.html"), html);
}
