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

  const challengeTarget = summaries[0]?.summary.acceptanceCriteria.minimumHttpRps ?? 250;
  const approvedCount = summaries.filter(({ summary }) => summary.acceptanceSatisfied).length;
  const rejectedCount = summaries.length - approvedCount;
  const bestThroughput = summaries.length > 0
    ? Math.max(...summaries.map(({ summary }) => Number(summary.measuredHttpRps) || 0))
    : 0;

  const rows = summaries.map(({ os, summary }) => {
    const acceptance = summary.acceptanceSatisfied ? 'Aprovado no desafio' : 'Reprovado no desafio';
    const failedRequirements = getFailedRequirements(summary);
    const failedRequirementsMarkup = failedRequirements.length > 0
      ? failedRequirements.map((item) => `<span class="fail-chip">${escapeHtml(item)}</span>`).join(' ')
      : '<span class="pass-chip">Todos os requisitos atendidos</span>';

    const comparison = getTimeComparison(summary);

    return `
      <tr>
        <td>${escapeHtml(os)}</td>
        <td>${escapeHtml(summary.testName)}</td>
        <td><span class="status-pill ${summary.acceptanceSatisfied ? 'status-pass' : 'status-fail'}">${escapeHtml(acceptance)}</span></td>
        <td>${summary.targetHttpRps} req/s</td>
        <td>${summary.measuredHttpRps} req/s</td>
        <td>${summary.businessMetrics.p90} ms</td>
        <td>${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</td>
        <td>${comparison.expectedLabel}</td>
        <td>${comparison.actualLabel}</td>
        <td>${failedRequirementsMarkup}</td>
      </tr>`;
  }).join('');

  const detailSections = summaries.map(({ os, summary }) => {
    const failedRequirements = getFailedRequirements(summary);
    const failedDetails = failedRequirements.length > 0
      ? failedRequirements.map((item) => `<span class="fail-chip">${escapeHtml(item)}</span>`).join(' ')
      : '<span class="pass-chip">Todos os requisitos atendidos</span>';
    const comparison = getTimeComparison(summary);
    const throughputBars = buildComparisonBars([
      {
        label: 'Meta minima do desafio',
        value: summary.acceptanceCriteria.minimumHttpRps,
        colorClass: 'bar-target',
        suffix: 'req/s'
      },
      {
        label: 'Alvo configurado do cenario',
        value: summary.targetHttpRps,
        colorClass: 'bar-scenario',
        suffix: 'req/s'
      },
      {
        label: 'Throughput medido',
        value: Number(summary.measuredHttpRps),
        colorClass: summary.acceptanceSatisfied ? 'bar-pass' : 'bar-fail',
        suffix: 'req/s'
      }
    ]);
    const timeBars = buildComparisonBars([
      {
        label: 'Tempo esperado para 250 requisicoes',
        value: comparison.expectedSeconds,
        colorClass: 'bar-target',
        suffix: 's'
      },
      {
        label: 'Tempo real para 250 requisicoes',
        value: comparison.actualSeconds,
        colorClass: summary.acceptanceSatisfied ? 'bar-pass' : 'bar-fail',
        suffix: 's'
      }
    ]);

    return `
    <section class="card">
      <div class="card-header">
        <div>
          <span class="card-kicker">${escapeHtml(os)}</span>
          <h2>${escapeHtml(summary.testName)}</h2>
        </div>
        <span class="status-pill ${summary.acceptanceSatisfied ? 'status-pass' : 'status-fail'}">${summary.acceptanceSatisfied ? 'Aprovado no desafio' : 'Reprovado no desafio'}</span>
      </div>
      <div class="metrics-strip">
        <div class="metric-box">
          <span>Throughput medido</span>
          <strong>${summary.measuredHttpRps} req/s</strong>
        </div>
        <div class="metric-box">
          <span>P90 da transacao</span>
          <strong>${summary.businessMetrics.p90} ms</strong>
        </div>
        <div class="metric-box">
          <span>Taxa de erro</span>
          <strong>${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</strong>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-item"><span>Cenario</span>${escapeHtml(summary.scenario)}</div>
        <div class="meta-item"><span>Meta minima do desafio</span>${summary.acceptanceCriteria.minimumHttpRps} req/s</div>
        <div class="meta-item"><span>Alvo configurado do cenario</span>${summary.targetHttpRps} req/s</div>
        <div class="meta-item"><span>Duracao total</span>${escapeHtml(summary.execution.totalDurationHuman)}</div>
        <div class="meta-item"><span>Inicio</span>${escapeHtml(summary.execution.startAt)}</div>
        <div class="meta-item"><span>Fim</span>${escapeHtml(summary.execution.endAt)}</div>
      </div>
      <div class="analysis-grid">
        <section class="panel">
          <h3>Falhas encontradas</h3>
          <div>${failedDetails}</div>
        </section>
        <section class="panel">
          <h3>Tempo para completar 250 requisicoes</h3>
          <p class="panel-note">Esperado: ${comparison.expectedLabel}. Real medido: ${comparison.actualLabel}.</p>
          ${timeBars}
        </section>
      </div>
      <section class="panel chart-panel">
        <h3>Grafico comparativo de throughput</h3>
        <p class="panel-note">Comparacao entre a meta minima do desafio, o alvo configurado no cenario e o throughput realmente entregue.</p>
        ${throughputBars}
      </section>
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
      --bg: #eef6f1;
      --bg-alt: #f7fbf8;
      --card: rgba(255, 255, 255, 0.92);
      --text: #163029;
      --muted: #5c6f68;
      --border: #c8ddd2;
      --accent: #1f7a5a;
      --accent-soft: #dff2e8;
      --ok: #197a43;
      --ok-soft: #def5e7;
      --bad: #b73a3a;
      --bad-soft: #fde4e4;
      --amber: #b7801a;
      --shadow: 0 20px 60px rgba(25, 71, 51, 0.10);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
      background:
        radial-gradient(circle at top left, rgba(31, 122, 90, 0.14), transparent 24%),
        radial-gradient(circle at top right, rgba(183, 58, 58, 0.10), transparent 18%),
        linear-gradient(180deg, var(--bg-alt) 0%, var(--bg) 100%);
      color: var(--text);
    }

    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }

    h1, h2, h3 {
      margin: 0 0 12px;
      letter-spacing: -0.02em;
    }

    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
      backdrop-filter: blur(10px);
    }

    .hero p {
      margin: 6px 0;
      color: var(--muted);
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .hero h1 {
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 1;
    }

    .hero-subtitle {
      max-width: 760px;
      font-size: 1.02rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      margin-top: 22px;
    }

    .summary-card,
    .panel,
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }

    .summary-card {
      border-radius: 22px;
      padding: 18px;
    }

    .summary-card span {
      display: block;
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 8px;
    }

    .summary-card strong {
      font-size: 2rem;
      line-height: 1;
    }

    .summary-card small {
      display: block;
      margin-top: 8px;
      color: var(--muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      margin-bottom: 24px;
    }

    th, td {
      padding: 14px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.9rem;
    }

    tbody tr:nth-child(even) {
      background: rgba(223, 242, 232, 0.35);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 18px;
      margin-top: 24px;
    }

    .card {
      border-radius: 26px;
      padding: 22px;
    }

    .fail-chip,
    .pass-chip {
      display: inline-block;
      margin: 4px 6px 0 0;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .fail-chip {
      background: var(--bad-soft);
      color: var(--bad);
      border: 1px solid #f2bcbc;
    }

    .pass-chip {
      background: var(--ok-soft);
      color: var(--ok);
      border: 1px solid #a9d9bc;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-pass {
      background: var(--ok-soft);
      color: var(--ok);
      border: 1px solid #a9d9bc;
    }

    .status-fail {
      background: var(--bad-soft);
      color: var(--bad);
      border: 1px solid #f2bcbc;
    }

    .legend {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.9rem;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 700;
    }

    .table-wrap {
      overflow-x: auto;
      border-radius: 24px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .card-kicker {
      display: inline-block;
      margin-bottom: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }

    .metric-box {
      padding: 14px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(223, 242, 232, 0.65), rgba(255, 255, 255, 0.96));
      border: 1px solid var(--border);
    }

    .metric-box span,
    .meta-item span {
      display: block;
      color: var(--muted);
      font-size: 0.86rem;
      margin-bottom: 6px;
    }

    .metric-box strong {
      font-size: 1.3rem;
    }

    .meta-grid,
    .analysis-grid {
      display: grid;
      gap: 12px;
    }

    .meta-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 16px;
    }

    .analysis-grid {
      grid-template-columns: 1.1fr 1fr;
      margin-bottom: 16px;
    }

    .meta-item,
    .panel {
      border-radius: 18px;
      padding: 16px;
    }

    .meta-item {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid var(--border);
    }

    .panel-note {
      margin: 0 0 12px;
      color: var(--muted);
    }

    .chart-panel {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(223, 242, 232, 0.55));
    }

    .bars {
      display: grid;
      gap: 12px;
    }

    .bar-row {
      display: grid;
      gap: 6px;
    }

    .bar-label {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 0.92rem;
    }

    .bar-track {
      width: 100%;
      height: 12px;
      border-radius: 999px;
      background: #e7f0ea;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
    }

    .bar-target {
      background: linear-gradient(90deg, #8aa81e, #b8cb67);
    }

    .bar-scenario {
      background: linear-gradient(90deg, #30a7a6, #72d6d0);
    }

    .bar-pass {
      background: linear-gradient(90deg, #1c8f4c, #49c56e);
    }

    .bar-fail {
      background: linear-gradient(90deg, #d95858, #f28c8c);
    }

    @media (max-width: 980px) {
      .metrics-strip,
      .meta-grid,
      .analysis-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      main {
        padding: 20px 14px 36px;
      }

      .hero,
      .card,
      .summary-card {
        padding: 18px;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="hero-top">
        <div>
          <span class="legend">GitHub Actions</span>
          <h1>Performance consolidada</h1>
          <p class="hero-subtitle">Leitura executiva dos cenarios rodando em Windows, macOS e Linux. Verde indica aprovacao no desafio. Vermelho indica reprovacao e explicita qual requisito falhou.</p>
        </div>
        <div class="summary-card">
          <span>Gerado em</span>
          <strong>${escapeHtml(generatedAt)}</strong>
          <small>Execucao diaria prevista para 08:00 em Brasilia.</small>
        </div>
      </div>
      <p>A regra final do desafio continua fixa: minimo de ${challengeTarget} req/s, p90 abaixo de 2000 ms e taxa de erro em 0%.</p>
      <p>Tambem mostramos quanto tempo seria necessario para completar 250 requisicoes no ritmo esperado e quanto tempo foi necessario no ritmo realmente medido.</p>
      <div class="summary-grid">
        <article class="summary-card">
          <span>Cenarios avaliados</span>
          <strong>${summaries.length}</strong>
          <small>Windows, macOS e Linux</small>
        </article>
        <article class="summary-card">
          <span>Aprovados</span>
          <strong style="color: var(--ok);">${approvedCount}</strong>
          <small>Atenderam todos os requisitos do desafio</small>
        </article>
        <article class="summary-card">
          <span>Reprovados</span>
          <strong style="color: var(--bad);">${rejectedCount}</strong>
          <small>Falharam em throughput, p90 ou erro</small>
        </article>
        <article class="summary-card">
          <span>Melhor throughput medido</span>
          <strong>${formatNumber(bestThroughput)} req/s</strong>
          <small>Maior valor entre os cenarios consolidados</small>
        </article>
      </div>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sistema operacional</th>
            <th>Teste</th>
            <th>Resultado</th>
            <th>Alvo do cenario</th>
            <th>Throughput medido</th>
            <th>P90</th>
            <th>Erros</th>
            <th>Tempo esperado para 250 req</th>
            <th>Tempo real para 250 req</th>
            <th>Falhas encontradas</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="grid">${detailSections}</div>
  </main>
</body>
</html>`;
}

function getFailedRequirements(summary) {
  const failed = [];

  if (summary.measuredHttpRps < summary.acceptanceCriteria.minimumHttpRps) {
    failed.push(`Nao atingiu o throughput minimo: ${summary.acceptanceCriteria.minimumHttpRps} req/s exigidos e ${formatNumber(summary.measuredHttpRps)} req/s medidos`);
  }

  if (summary.businessMetrics.p90 >= summary.acceptanceCriteria.p90UnderMs) {
    failed.push(`Latencia acima do limite: maximo de ${summary.acceptanceCriteria.p90UnderMs} ms e ${summary.businessMetrics.p90} ms medidos`);
  }

  if (summary.businessMetrics.errorRate !== 0) {
    failed.push(`Taxa de erro acima de 0%: ${(summary.businessMetrics.errorRate * 100).toFixed(2)}% encontrados`);
  }

  return failed;
}

function getTimeComparison(summary) {
  const expectedSeconds = 250 / summary.acceptanceCriteria.minimumHttpRps;
  const measuredRps = Number(summary.measuredHttpRps) || 0;
  const actualSeconds = measuredRps > 0 ? 250 / measuredRps : Number.POSITIVE_INFINITY;

  return {
    expectedSeconds,
    actualSeconds,
    expectedLabel: formatSeconds(expectedSeconds),
    actualLabel: Number.isFinite(actualSeconds) ? formatSeconds(actualSeconds) : 'Nao conclui 250 requisicoes nesse ritmo'
  };
}

function buildComparisonBars(items) {
  const maxValue = Math.max(...items.map((item) => item.value).filter((value) => Number.isFinite(value) && value > 0), 1);

  return `<div class="bars">${items.map((item) => {
    const normalized = Number.isFinite(item.value) ? Math.max((item.value / maxValue) * 100, 2) : 0;
    const displayValue = item.suffix === 's' ? formatSeconds(item.value) : `${formatNumber(item.value)} ${item.suffix}`;

    return `<div class="bar-row">
      <div class="bar-label">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(displayValue)}</strong>
      </div>
      <div class="bar-track"><div class="bar-fill ${item.colorClass}" style="width: ${normalized}%;"></div></div>
    </div>`;
  }).join('')}</div>`;
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) {
    return 'Nao disponivel';
  }

  if (value < 1) {
    return `${formatNumber(value, 2)} s`;
  }

  return `${formatNumber(value, value >= 10 ? 1 : 2)} s`;
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}