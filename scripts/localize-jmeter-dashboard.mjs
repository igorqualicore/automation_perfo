import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dashboardDirectory = process.argv[2];
const resultsFile = process.argv[3];
const summaryJsonFile = process.argv[4];

if (!dashboardDirectory) {
  console.error('Uso: node ./scripts/localize-jmeter-dashboard.mjs <dashboard-dir>');
  process.exit(1);
}

const replacements = buildReplacements();
const regexReplacements = buildRegexReplacements();
const metadata = resultsFile && summaryJsonFile ? buildMetadata(resultsFile, summaryJsonFile) : null;
const candidateFiles = collectFiles(path.resolve(dashboardDirectory))
  .filter((filePath) => filePath.endsWith('.html') || filePath.endsWith('.js'));

for (const filePath of candidateFiles) {
  const currentContent = readFileSync(filePath, 'utf8');
  let localizedContent = applyRegexReplacements(applyReplacements(currentContent, replacements), regexReplacements);

  if (metadata && filePath.endsWith('.html')) {
    localizedContent = applyMetadata(localizedContent, metadata);
  }

  if (localizedContent !== currentContent) {
    writeFileSync(filePath, localizedContent, 'utf8');
  }
}

function buildMetadata(resultsPath, summaryPath) {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

  return {
    sourceFile: path.basename(resultsPath),
    startAt: summary.execution?.startAt,
    endAt: summary.execution?.endAt,
    duration: summary.execution?.totalDurationHuman
  };
}

function buildReplacements() {
  const entries = [
    ['<html lang="en">', '<html lang="pt-BR">'],
    ['Apache JMeter Dashboard', 'Painel Apache JMeter'],
    ['Elapsed Time (granularity: ', 'Tempo decorrido (granularidade: '],
    ['Connect Time (granularity: ', 'Tempo de conexao (granularidade: '],
    [' day(s)', ' dia(s)'],
    [' hour(s)', ' hora(s)'],
    [' min', ' min'],
    [' sec', ' s'],
    [' ms', ' ms'],
    ['Toggle navigation', 'Alternar navegacao'],
    ['Close', 'Fechar'],
    ['"FAIL"', '"FALHA"'],
    ['"PASS"', '"SUCESSO"'],
    ['"Requests"', '"Requisicoes"'],
    ['"Executions"', '"Execucoes"'],
    ['"Response Times (ms)"', '"Tempos de resposta (ms)"'],
    ['"Network (KB/sec)"', '"Rede (KB/s)"'],
    ['"Apdex"', '"Apdex"'],
    ['"T (Toleration threshold)"', '"T (limite de tolerancia)"'],
    ['"F (Frustration threshold)"', '"F (limite de frustracao)"'],
    ['"Label"', '"Rotulo"'],
    ['"#Samples"', '"#Amostras"'],
    ['"Average"', '"Media"'],
    ['"Transactions/s"', '"Transacoes/s"'],
    ['"Received"', '"Recebido"'],
    ['"Sent"', '"Enviado"'],
    ['"Type of error"', '"Tipo de erro"'],
    ['"Number of errors"', '"Numero de erros"'],
    ['"% in errors"', '"% nos erros"'],
    ['"% in all samples"', '"% em todas as amostras"'],
    ['"Sample"', '"Amostra"'],
    ['"Response Time Percentiles Over Time (successful responses)"', '"Percentis de tempo de resposta ao longo do tempo (respostas com sucesso)"'],
    ['"Response Times Over Time"', '"Tempos de resposta ao longo do tempo"'],
    ['"Active Threads Over Time"', '"Threads ativas ao longo do tempo"'],
    ['"Bytes Throughput Over Time"', '"Vazao em bytes ao longo do tempo"'],
    ['"Latencies Over Time"', '"Latencias ao longo do tempo"'],
    ['"Connect Time Over Time"', '"Tempo de conexao ao longo do tempo"'],
    ['"Hits Per Second"', '"Hits por segundo"'],
    ['"Codes Per Second"', '"Codigos por segundo"'],
    ['"Transactions Per Second"', '"Transacoes por segundo"'],
    ['"Total Transactions Per Second"', '"Total de transacoes por segundo"'],
    ['"Response Time Vs Request"', '"Tempo de resposta vs requisicao"'],
    ['"Latency Vs Request"', '"Latencia vs requisicao"'],
    ['"Response Time Percentiles"', '"Percentis de tempo de resposta"'],
    ['"Response Time Overview"', '"Visao geral do tempo de resposta"'],
    ['"Time Vs Threads"', '"Tempo vs threads"'],
    ['"Response Time Distribution"', '"Distribuicao do tempo de resposta"']
  ];

  return entries.sort((left, right) => right[0].length - left[0].length);
}

function collectFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const entryStats = statSync(absolutePath);

    if (entryStats.isDirectory()) {
      files.push(...collectFiles(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}

function applyReplacements(content, entries) {
  return entries.reduce((updatedContent, [source, target]) => updatedContent.split(source).join(target), content);
}

function buildRegexReplacements() {
  return [
    [/>(\s*)Dashboard(\s*)</g, '>Painel<'],
    [/>(\s*)Charts(\s*)</g, '>Graficos<'],
    [/>(\s*)Customs Graphs(\s*)</g, '>Graficos personalizados<'],
    [/>(\s*)Over Time(?=<)/g, '>Ao longo do tempo'],
    [/>(\s*)Throughput(?=<)/g, '>Vazao'],
    [/>(\s*)Response Times(?=<)/g, '>Tempos de resposta'],
    [/>(\s*)Test and Report information(\s*)</g, '>Informacoes do teste e do relatorio<'],
    [/>(\s*)Source file(\s*)</g, '>Arquivo de origem<'],
    [/>(\s*)File:(\s*)</g, '>Arquivo:<'],
    [/>(\s*)Start Time:(\s*)</g, '>Hora de inicio:<'],
    [/>(\s*)Start Time(\s*)</g, '>Hora de inicio<'],
    [/>(\s*)End Time:(\s*)</g, '>Hora de termino:<'],
    [/>(\s*)End Time(\s*)</g, '>Hora de termino<'],
    [/>(\s*)Filter for display:(\s*)</g, '>Filtro de exibicao:<'],
    [/>(\s*)Filter for display(\s*)</g, '>Filtro de exibicao<'],
    [/>(\s*)Requests Summary(\s*)</g, '>Resumo das requisicoes<'],
    [/>(\s*)Statistics(\s*)</g, '>Estatisticas<'],
    [/>(\s*)Errors(\s*)</g, '>Erros<'],
    [/>(\s*)Top 5 Errors by sampler(\s*)</g, '>Top 5 erros por amostrador<'],
    [/>(\s*)Display all samples(\s*)</g, '>Exibir todas as amostras<'],
    [/>(\s*)Hide all samples(\s*)</g, '>Ocultar todas as amostras<'],
    [/>(\s*)Display samples(\s*)</g, '>Exibir amostras<'],
    [/>(\s*)Hide samples(\s*)</g, '>Ocultar amostras<'],
    [/>(\s*)Save as PNG(\s*)</g, '>Salvar como PNG<'],
    [/>(\s*)Zoom :(\s*)</g, '>Zoom:<'],
    [/>(\s*)Response Times Over Time(\s*)</g, '>Tempos de resposta ao longo do tempo<'],
    [/>(\s*)Response Time Percentiles Over Time \(successful responses\)(\s*)</g, '>Percentis de tempo de resposta ao longo do tempo (respostas com sucesso)<'],
    [/>(\s*)Active Threads Over Time(\s*)</g, '>Threads ativas ao longo do tempo<'],
    [/>(\s*)Bytes Throughput Over Time(\s*)</g, '>Vazao em bytes ao longo do tempo<'],
    [/>(\s*)Latencies Over Time(\s*)</g, '>Latencias ao longo do tempo<'],
    [/>(\s*)Connect Time Over Time(\s*)</g, '>Tempo de conexao ao longo do tempo<'],
    [/>(\s*)Hits Per Second(\s*)</g, '>Hits por segundo<'],
    [/>(\s*)Codes Per Second(\s*)</g, '>Codigos por segundo<'],
    [/>(\s*)Transactions Per Second(\s*)</g, '>Transacoes por segundo<'],
    [/>(\s*)Total Transactions Per Second(\s*)</g, '>Total de transacoes por segundo<'],
    [/>(\s*)Response Time Vs Request(\s*)</g, '>Tempo de resposta vs requisicao<'],
    [/>(\s*)Latency Vs Request(\s*)</g, '>Latencia vs requisicao<'],
    [/>(\s*)Response Time Percentiles(\s*)</g, '>Percentis de tempo de resposta<'],
    [/>(\s*)Response Time Overview(\s*)</g, '>Visao geral do tempo de resposta<'],
    [/>(\s*)Time Vs Threads(\s*)</g, '>Tempo vs threads<'],
    [/>(\s*)Response Time Distribution(\s*)</g, '>Distribuicao do tempo de resposta<']
  ];
}

function applyRegexReplacements(content, entries) {
  return entries.reduce((updatedContent, [pattern, target]) => updatedContent.replace(pattern, target), content);
}

function applyMetadata(content, metadata) {
  let updatedContent = content;

  updatedContent = updatedContent.replace(/<td>"results\.jtl"<\/td>/g, `<td>${metadata.sourceFile}</td>`);

  if (metadata.startAt) {
    updatedContent = updatedContent.replace(/<td>"\d+"<\/td>/, `<td>${metadata.startAt}</td>`);
  }

  if (metadata.endAt) {
    updatedContent = updatedContent.replace(/<td>"\d+"<\/td>/, `<td>${metadata.endAt}</td>`);
  }

  if (metadata.duration && !updatedContent.includes('Duracao total')) {
    updatedContent = updatedContent.replace(
      /(<tr>\s*<td>Filtro de exibicao:?<\/td>\s*<td>""<\/td>\s*<\/tr>)/,
      `$1\n                                <tr>\n                                    <td>Duracao total</td>\n                                    <td>${metadata.duration}</td>\n                                </tr>`
    );
  }

  return updatedContent;
}