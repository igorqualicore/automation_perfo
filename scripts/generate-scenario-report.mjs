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

  const statusText = summary.acceptanceSatisfied ? 'Atende aos requisitos' : 'Reprovado no desafio';
  const statusClass = summary.acceptanceSatisfied ? 'pass' : 'fail';
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(summary.testName)} - Relatorio executivo</title>
  <style>
    :root {
      --bg: #f4efe7;
      --panel: #fffaf3;
      --ink: #1f2933;
      --muted: #5f6c7a;
      --line: #d9cbb7;
      --brand: #9a3412;
      --brand-soft: #f4d7bf;
      --ok: #216e39;
      --ok-soft: #dff3e4;
      --bad: #a61b1b;
      --bad-soft: #fde2e2;
      --shadow: 0 18px 48px rgba(55, 35, 15, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: radial-gradient(circle at top left, rgba(154, 52, 18, 0.10), transparent 28%), linear-gradient(180deg, #f8f2ea 0%, var(--bg) 100%);
      font-family: Georgia, 'Times New Roman', serif;
    }
    main { max-width: 1160px; margin: 0 auto; padding: 28px 20px 44px; }
    .hero, .panel, table { background: var(--panel); border: 1px solid var(--line); box-shadow: var(--shadow); }
    .hero { border-radius: 24px; padding: 28px; margin-bottom: 22px; }
    .eyebrow { display: inline-block; padding: 6px 12px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; }
    h1, h2 { margin: 10px 0 12px; }
    p { color: var(--muted); }
    .status-banner { margin-top: 18px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--line); font-weight: 700; }
    .status-banner.pass { background: var(--ok-soft); color: var(--ok); border-color: #acd8b8; }
    .status-banner.fail { background: var(--bad-soft); color: var(--bad); border-color: #f2bcbc; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 0 0 22px; }
    .panel { border-radius: 20px; padding: 20px; }
    .metric-label { font-size: 0.9rem; color: var(--muted); margin-bottom: 8px; }
    .metric-value { font-size: 2rem; font-weight: 700; color: var(--ink); }
    .metric-note { margin-top: 8px; color: var(--muted); font-size: 0.95rem; }
    .two-col { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; margin-bottom: 22px; }
    .requirements { list-style: none; padding: 0; margin: 0; }
    .requirement { display: grid; grid-template-columns: 1fr auto; gap: 8px 14px; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .requirement:last-child { border-bottom: 0; }
    .requirement small { grid-column: 1 / -1; color: var(--muted); }
    .requirement.pass strong { color: var(--ok); }
    .requirement.fail strong { color: var(--bad); }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .meta-item { padding: 12px; border-radius: 14px; background: #f9f3eb; border: 1px solid var(--line); }
    .meta-item span { display: block; color: var(--muted); font-size: 0.85rem; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; border-radius: 20px; overflow: hidden; }
    th, td { padding: 14px 12px; border-bottom: 1px solid var(--line); text-align: left; }
    th { background: var(--brand-soft); color: var(--brand); }
    .links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    .button { display: inline-block; padding: 12px 16px; border-radius: 999px; border: 1px solid var(--line); text-decoration: none; font-weight: 700; color: var(--ink); background: white; }
    .button.primary { background: var(--brand); color: #fff; border-color: var(--brand); }
    .footnote { margin-top: 12px; font-size: 0.92rem; color: var(--muted); }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } .meta { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="eyebrow">Relatorio executivo</span>
      <h1>${escapeHtml(summary.testName)}</h1>
      <p>Resumo visual do cenario ${escapeHtml(currentScenario)} com foco nos requisitos do desafio. O dashboard do JMeter continua disponivel como anexo tecnico.</p>
      <p>A aprovacao final sempre considera a meta minima do desafio de ${challengeTarget} req/s. O alvo configurado do cenario mostra o quanto a carga tentou forcar o sistema: neste caso, ${scenarioTarget} req/s.</p>
      <div class="status-banner ${statusClass}">${escapeHtml(statusText)}</div>
      <div class="links">
        <a class="button primary" href="./dashboard/index.html">Abrir dashboard tecnico do JMeter</a>
        <a class="button" href="./summary.md">Abrir resumo Markdown</a>
        <a class="button" href="./summary.json">Abrir resumo JSON</a>
      </div>
      <p class="footnote">Se o dashboard tecnico estiver feio ou muito detalhado, use esta pagina como relatorio principal e o dashboard do JMeter apenas para aprofundamento.</p>
    </section>
    <section class="grid">
      <article class="panel"><div class="metric-label">Throughput HTTP medido</div><div class="metric-value">${summary.measuredHttpRps} req/s</div><div class="metric-note">Meta minima do desafio: ${challengeTarget} req/s</div></article>
      <article class="panel"><div class="metric-label">Alvo configurado do cenario</div><div class="metric-value">${scenarioTarget} req/s</div><div class="metric-note">Valor usado para forcar a carga neste teste</div></article>
      <article class="panel"><div class="metric-label">P90 da transacao</div><div class="metric-value">${summary.businessMetrics.p90} ms</div><div class="metric-note">Meta: abaixo de ${summary.acceptanceCriteria.p90UnderMs} ms</div></article>
      <article class="panel"><div class="metric-label">Taxa de erro</div><div class="metric-value">${(summary.businessMetrics.errorRate * 100).toFixed(2)}%</div><div class="metric-note">Meta: 0.00%</div></article>
      <article class="panel"><div class="metric-label">Compras concluidas</div><div class="metric-value">${summary.businessMetrics.count}</div><div class="metric-note">Janela analisada: ${summary.testWindowSeconds}s</div></article>
    </section>
    <section class="two-col">
      <article class="panel"><h2>Atendimento aos requisitos</h2><ul class="requirements">${requirementRows}</ul></article>
      <article class="panel"><h2>Dados da execucao</h2><div class="meta"><div class="meta-item"><span>Inicio</span>${escapeHtml(summary.execution.startAt)}</div><div class="meta-item"><span>Fim</span>${escapeHtml(summary.execution.endAt)}</div><div class="meta-item"><span>Duracao total</span>${escapeHtml(summary.execution.totalDurationHuman)}</div><div class="meta-item"><span>Warm-up excluido</span>${summary.warmupExcludedSeconds}s</div><div class="meta-item"><span>Media HTTP</span>${summary.requestMetrics.avg} ms</div><div class="meta-item"><span>P90 HTTP</span>${summary.requestMetrics.p90} ms</div></div></article>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}