import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const summaryJsonArg = process.argv[2];
const outputHtmlArg = process.argv[3];
const scenarioArg = process.argv[4];

if (!summaryJsonArg || !outputHtmlArg) {
  console.error('Uso: node ./scripts/generate-scenario-report.mjs <summary-json> <output-html> [scenario]');
  process.exit(1);
}

const summary = JSON.parse(readFileSync(path.resolve(summaryJsonArg), 'utf8'));
const scenario = scenarioArg || summary.scenario || 'cenario';

writeFileSync(path.resolve(outputHtmlArg), renderHtmlSummary(summary, scenario), 'utf8');

function renderHtmlSummary(summary, currentScenario) {
  const challengeTarget = summary.acceptanceCriteria.minimumHttpRps;
  const scenarioTarget = summary.targetHttpRps;
  const timeComparison = getTimeComparison(summary);
  const requirements = [
    {
      label: `Throughput HTTP minimo do desafio: ${challengeTarget} req/s`,
      passed: summary.measuredHttpRps >= challengeTarget,
      detail: `${summary.measuredHttpRps} req/s medidos em um cenario com alvo configurado de ${scenarioTarget} req/s`
    },
    {
      label: 'P90 da transacao abaixo de 2000 ms',
      passed: summary.businessMetrics.p90 < summary.acceptanceCriteria.p90UnderMs,
      detail: `${summary.businessMetrics.p90} ms medidos`
    },
    {
      label: 'Taxa de erro igual a 0%',
      passed: summary.businessMetrics.errorRate === 0,
      detail: `${(summary.businessMetrics.errorRate * 100).toFixed(2)}%`
    }
  ];

  const statusText = summary.acceptanceSatisfied ? 'Aprovado no desafio' : 'Reprovado no desafio';
  const statusClass = summary.acceptanceSatisfied ? 'status-pass' : 'status-fail';
  const failedRequirements = getFailedRequirements(summary);
  const failedRequirementsMarkup = failedRequirements.length > 0
    ? failedRequirements.map((item) => `<span class="fail-chip">${escapeHtml(item)}</span>`).join(' ')
    : '<span class="pass-chip">Todos os requisitos atendidos</span>';
  const requirementRows = requirements.map((requirement) => `
        <li class="requirement ${requirement.passed ? 'pass' : 'fail'}">
          <span>${escapeHtml(requirement.label)}</span>
          <strong>${requirement.passed ? 'Passou' : 'Falhou'}</strong>
          <small>${escapeHtml(requirement.detail)}</small>
        </li>`).join('');

  const sampleRows = Object.entries(summary.samplesByLabel)
    .map(([label, metrics]) => `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td>${metrics.count}</td>
            <td>${metrics.throughput}</td>
            <td>${metrics.avg} ms</td>
            <td>${metrics.p90} ms</td>
            <td>${(metrics.errorRate * 100).toFixed(2)}%</td>
          </tr>`)
    .join('');

  const throughputBars = buildComparisonBars([
    {
      label: 'Meta minima do desafio',
      value: challengeTarget,
      colorClass: 'bar-target',
      suffix: 'req/s'
    },
    {
      label: 'Alvo configurado do cenario',
      value: scenarioTarget,
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
      value: timeComparison.expectedSeconds,
      colorClass: 'bar-target',
      suffix: 's'
    },
    {
      label: 'Tempo real para 250 requisicoes',
      value: timeComparison.actualSeconds,
      colorClass: summary.acceptanceSatisfied ? 'bar-pass' : 'bar-fail',
      suffix: 's'
    }
  ]);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(summary.testName)} - Relatorio executivo</title>
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
      --shadow: 0 20px 60px rgba(25, 71, 51, 0.10);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(31, 122, 90, 0.14), transparent 24%),
        radial-gradient(circle at top right, rgba(183, 58, 58, 0.10), transparent 18%),
        linear-gradient(180deg, var(--bg-alt) 0%, var(--bg) 100%);
      font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
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

    p {
      color: var(--muted);
    }

    .hero,
    .summary-card,
    .panel,
    .metric-box,
    .meta-item,
    table {
      background: var(--card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .hero {
      border-radius: 28px;
      padding: 28px;
      margin-bottom: 24px;
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
      flex-wrap: wrap;
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

    .hero h1 {
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 1;
    }

    .hero-subtitle {
      max-width: 760px;
      font-size: 1.02rem;
    }

    .summary-card {
      border-radius: 22px;
      padding: 18px;
      min-width: 260px;
    }

    .summary-card span,
    .metric-box span,
    .meta-item span {
      display: block;
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 8px;
    }

    .summary-card strong {
      font-size: 2rem;
      line-height: 1;
    }

    .summary-card small,
    .panel-note {
      display: block;
      margin-top: 8px;
      color: var(--muted);
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

    .links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .button {
      display: inline-block;
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      text-decoration: none;
      font-weight: 700;
      color: var(--text);
      background: white;
    }

    .button.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .footnote {
      margin-top: 12px;
      font-size: 0.92rem;
      color: var(--muted);
    }

    .summary-grid,
    .metrics-strip,
    .meta-grid,
    .analysis-grid {
      display: grid;
      gap: 14px;
    }

    .summary-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      margin-top: 22px;
    }

    .metrics-strip {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-bottom: 18px;
    }

    .metric-box {
      padding: 16px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(223, 242, 232, 0.65), rgba(255, 255, 255, 0.96));
    }

    .metric-box strong {
      font-size: 1.35rem;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 18px;
      margin-bottom: 22px;
    }

    .panel {
      border-radius: 24px;
      padding: 20px;
    }

    .requirements {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .requirement {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 14px;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }

    .requirement:last-child {
      border-bottom: 0;
    }

    .requirement small {
      grid-column: 1 / -1;
      color: var(--muted);
    }

    .requirement.pass strong {
      color: var(--ok);
    }

    .requirement.fail strong {
      color: var(--bad);
    }

    .meta-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-bottom: 16px;
    }

    .meta-item {
      border-radius: 18px;
      padding: 16px;
    }

    .analysis-grid {
      grid-template-columns: 1fr;
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

    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 24px;
      overflow: hidden;
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

    @media (max-width: 980px) {
      .metrics-strip,
      .content-grid,
      .meta-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      main {
        padding: 20px 14px 36px;
      }

      .hero,
      .panel,
      .summary-card,
      .metric-box,
      .meta-item {
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
          <span class="legend">Relatorio executivo</span>
          <h1>${escapeHtml(summary.testName)}</h1>
          <p class="hero-subtitle">Leitura executiva do cenario ${escapeHtml(currentScenario)} com a mesma linguagem visual do consolidado. Verde indica aprovacao no desafio. Vermelho indica reprovacao e explicita o que falhou.</p>
        </div>
        <div class="summary-card">
          <span>Resultado final</span>
          <strong style="color: ${summary.acceptanceSatisfied ? 'var(--ok)' : 'var(--bad)'};">${escapeHtml(statusText)}</strong>
          <small>Regra fixa do desafio: ${challengeTarget} req/s, p90 abaixo de ${summary.acceptanceCriteria.p90UnderMs} ms e 0% de erro.</small>
        </div>
      </div>
      <p>A aprovacao final sempre considera a meta minima do desafio de ${challengeTarget} req/s. O alvo configurado do cenario mostra apenas o quanto a carga tentou forcar o ambiente: neste caso, ${scenarioTarget} req/s.</p>
      <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
      <div class="links">
        <a class="button primary" href="./dashboard/index.html">Abrir dashboard tecnico do JMeter</a>
        <a class="button" href="./summary.md">Abrir resumo Markdown</a>
        <a class="button" href="./summary.json">Abrir resumo JSON</a>
      </div>
      <p class="footnote">Se o dashboard tecnico estiver feio ou muito detalhado, use esta pagina como relatorio principal e o dashboard do JMeter apenas para aprofundamento.</p>
      <div class="summary-grid">
        <article class="summary-card">
          <span>Tempo esperado para 250 requisicoes</span>
          <strong>${escapeHtml(timeComparison.expectedLabel)}</strong>
          <small>Ritmo esperado para cumprir a meta minima</small>
        </article>
        <article class="summary-card">
          <span>Tempo real para 250 requisicoes</span>
          <strong>${escapeHtml(timeComparison.actualLabel)}</strong>
          <small>Ritmo realmente medido nesta execucao</small>
        </article>
        <article class="summary-card">
          <span>Compras concluidas</span>
          <strong>${summary.businessMetrics.count}</strong>
          <small>Janela analisada: ${summary.testWindowSeconds}s</small>
        </article>
      </div>
    </section>
    <section class="metrics-strip">
      <article class="metric-box"><span>Throughput medido</span><strong>${summary.measuredHttpRps} req/s</strong></article>
      <article class="metric-box"><span>Meta minima do desafio</span><strong>${challengeTarget} req/s</strong></article>
      <article class="metric-box"><span>Alvo configurado do cenario</span><strong>${scenarioTarget} req/s</strong></article>
      <article class="metric-box"><span>P90 da transacao</span><strong>${summary.businessMetrics.p90} ms</strong></article>
    </section>
    <section class="content-grid">
      <article class="panel">
        <h2>Atendimento aos requisitos</h2>
        <ul class="requirements">${requirementRows}</ul>
      </article>
      <article class="panel">
        <h2>Resumo da execucao</h2>
        <div class="meta-grid">
          <div class="meta-item"><span>Cenario</span>${escapeHtml(currentScenario)}</div>
          <div class="meta-item"><span>Taxa de erro</span>${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</div>
          <div class="meta-item"><span>Inicio</span>${escapeHtml(summary.execution.startAt)}</div>
          <div class="meta-item"><span>Fim</span>${escapeHtml(summary.execution.endAt)}</div>
          <div class="meta-item"><span>Duracao total</span>${escapeHtml(summary.execution.totalDurationHuman)}</div>
          <div class="meta-item"><span>Warm-up excluido</span>${summary.warmupExcludedSeconds}s</div>
          <div class="meta-item"><span>Media HTTP</span>${summary.requestMetrics.avg} ms</div>
          <div class="meta-item"><span>P90 HTTP</span>${summary.requestMetrics.p90} ms</div>
        </div>
        <div class="analysis-grid">
          <section>
            <h3>Falhas encontradas</h3>
            <div>${failedRequirementsMarkup}</div>
          </section>
          <section>
            <h3>Tempo para completar 250 requisicoes</h3>
            <p class="panel-note">Esperado: ${escapeHtml(timeComparison.expectedLabel)}. Real medido: ${escapeHtml(timeComparison.actualLabel)}.</p>
            ${timeBars}
          </section>
        </div>
      </article>
    </section>
    <section class="panel" style="margin-bottom: 22px;">
      <h2>Grafico comparativo de throughput</h2>
      <p class="panel-note">Comparacao entre a meta minima do desafio, o alvo configurado no cenario e o throughput realmente entregue.</p>
      ${throughputBars}
    </section>
    <section>
      <h2>Quebra por etapa</h2>
      <table>
        <thead><tr><th>Etapa</th><th>Amostras</th><th>Req/s</th><th>Media</th><th>P90</th><th>Erro</th></tr></thead>
        <tbody>${sampleRows}</tbody>
      </table>
    </section>
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