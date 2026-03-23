import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const inputDirectory = process.argv[2];
const outputFile = process.argv[3];

if (!inputDirectory || !outputFile) {
  console.error('Uso: node ./scripts/generate-matrix-report.mjs <input-dir> <output-file>');
  process.exit(1);
}

const resolvedInputDirectory = path.resolve(inputDirectory);
const resolvedOutputFile = path.resolve(outputFile);
const osDirectories = readdirSync(resolvedInputDirectory)
  .map((entry) => path.join(resolvedInputDirectory, entry))
  .filter((entryPath) => statSync(entryPath).isDirectory())
  .filter((entryPath) => existsSync(path.join(entryPath, 'summary.json')));

const summaries = osDirectories.map((directory) => {
  const summary = JSON.parse(readFileSync(path.join(directory, 'summary.json'), 'utf8'));

  return {
    os: path.basename(directory),
    summary,
    reportRelativePath: `${path.basename(directory)}/index.html`
  };
});

mkdirSync(path.dirname(resolvedOutputFile), { recursive: true });
writeFileSync(resolvedOutputFile, buildHtml(summaries), 'utf8');

function buildHtml(summaries) {
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date());

  const rows = summaries.map(({ os, summary, reportRelativePath }) => {
    const acceptance = summary.acceptanceSatisfied ? 'Atende aos requisitos' : 'Reprovado no desafio';
    const failedRequirements = getFailedRequirements(summary);
    const failedRequirementsMarkup = failedRequirements.length > 0
      ? failedRequirements.map((item) => `<span class="fail-chip">${escapeHtml(item)}</span>`).join(' ')
      : '<span class="pass-chip">Nenhuma</span>';
    return `
      <tr>
        <td>${escapeHtml(os)}</td>
        <td>${escapeHtml(summary.testName)}</td>
        <td>${summary.targetHttpRps} req/s</td>
        <td>${escapeHtml(summary.execution.startAt)}</td>
        <td>${escapeHtml(summary.execution.endAt)}</td>
        <td>${escapeHtml(summary.execution.totalDurationHuman)}</td>
        <td>${summary.measuredHttpRps}</td>
        <td>${summary.businessMetrics.p90} ms</td>
        <td>${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</td>
        <td>${escapeHtml(acceptance)}</td>
        <td>${failedRequirementsMarkup}</td>
        <td><a href="../${reportRelativePath}">Abrir relatorio individual</a></td>
      </tr>`;
  }).join('');

  const detailSections = summaries.map(({ os, summary }) => {
    const failedRequirements = getFailedRequirements(summary);
    const failedDetails = failedRequirements.length > 0
      ? failedRequirements.map((item) => `<span class="fail-chip">${escapeHtml(item)}</span>`).join(' ')
      : '<span class="pass-chip">Nenhuma falha</span>';

    return `
    <section class="card">
      <h2>${escapeHtml(os)}</h2>
      <p><strong>Cenario:</strong> ${escapeHtml(summary.scenario)}</p>
      <p><strong>Alvo do cenario:</strong> ${summary.targetHttpRps} req/s</p>
      <p><strong>Meta minima do desafio:</strong> ${summary.acceptanceCriteria.minimumHttpRps} req/s</p>
      <p><strong>Inicio:</strong> ${escapeHtml(summary.execution.startAt)}</p>
      <p><strong>Fim:</strong> ${escapeHtml(summary.execution.endAt)}</p>
      <p><strong>Duracao:</strong> ${escapeHtml(summary.execution.totalDurationHuman)}</p>
      <p><strong>Throughput HTTP:</strong> ${summary.measuredHttpRps} req/s</p>
      <p><strong>P90 da transacao:</strong> ${summary.businessMetrics.p90} ms</p>
      <p><strong>Taxa de erro:</strong> ${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</p>
      <p><strong>Status:</strong> ${summary.acceptanceSatisfied ? 'Atende aos requisitos' : 'Reprovado no desafio'}</p>
      <p><strong>Falhas encontradas:</strong> ${failedDetails}</p>
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatorio Consolidado Cross-Platform</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f1e8;
      --card: #fffaf2;
      --text: #1f2a37;
      --muted: #5b6470;
      --border: #dbcdb8;
      --accent: #9c4f2f;
      --accent-soft: #f1d8c8;
      --ok: #2f7d4f;
      --bad: #a63d40;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      background: linear-gradient(180deg, #f3ede2 0%, var(--bg) 100%);
      color: var(--text);
    }

    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }

    h1, h2 {
      margin: 0 0 12px;
      letter-spacing: 0.02em;
    }

    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(50, 35, 20, 0.08);
      margin-bottom: 24px;
    }

    .hero p {
      margin: 6px 0;
      color: var(--muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(50, 35, 20, 0.08);
    }

    th, td {
      padding: 14px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--accent-soft);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 12px 40px rgba(50, 35, 20, 0.08);
    }

    .card p {
      margin: 8px 0;
    }

    .fail-chip,
    .pass-chip {
      display: inline-block;
      margin: 4px 6px 0 0;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .fail-chip {
      background: #fde2e2;
      color: #a63d40;
      border: 1px solid #efb3b5;
    }

    .pass-chip {
      background: #dff3e4;
      color: #2f7d4f;
      border: 1px solid #a9d3b5;
    }

    a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }

    .legend {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.9rem;
      background: var(--accent-soft);
      color: var(--text);
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="legend">GitHub Actions</span>
      <h1>Relatorio consolidado de performance cross-platform</h1>
      <p>Execucao agendada diariamente as 08:00 no horario de Brasilia, equivalente a 11:00 UTC.</p>
      <p>Gerado em: ${escapeHtml(generatedAt)}</p>
      <p>Este relatorio consolida os resultados de Windows, macOS e Linux em um unico HTML.</p>
      <p>O status final sempre compara o resultado com a meta minima do desafio de 250 req/s, p90 abaixo de 2000 ms e 0% de erro. O alvo do cenario mostra apenas o quanto cada teste tentou forcar o ambiente.</p>
      <p>Os links funcionam quando este arquivo e as pastas linux, windows e macos sao abertas juntos, mantendo a estrutura completa do artifact extraido.</p>
    </section>

    <table>
      <thead>
        <tr>
          <th>Sistema operacional</th>
          <th>Teste</th>
          <th>Alvo do cenario</th>
          <th>Inicio</th>
          <th>Fim</th>
          <th>Duracao</th>
          <th>Throughput HTTP</th>
          <th>P90 da transacao</th>
          <th>Erros</th>
          <th>Atendimento aos requisitos</th>
          <th>Falhas encontradas</th>
          <th>Relatorio individual</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="grid">${detailSections}</div>
  </main>
</body>
</html>`;
}

function getFailedRequirements(summary) {
  const failed = [];

  if (summary.measuredHttpRps < summary.acceptanceCriteria.minimumHttpRps) {
    failed.push(`Throughput abaixo de ${summary.acceptanceCriteria.minimumHttpRps} req/s`);
  }

  if (summary.businessMetrics.p90 >= summary.acceptanceCriteria.p90UnderMs) {
    failed.push(`P90 acima de ${summary.acceptanceCriteria.p90UnderMs} ms`);
  }

  if (summary.businessMetrics.errorRate !== 0) {
    failed.push('Taxa de erro acima de 0%');
  }

  return failed;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}