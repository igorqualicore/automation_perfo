import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUSINESS_LABEL = 'Compra de passagem - sucesso';
const HTTP_SAMPLES_PER_TRANSACTION = 4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const [scenario, propertyFileArgument] = process.argv.slice(2);

if (!scenario || !propertyFileArgument) {
  console.error('Uso: node ./scripts/run-jmeter.mjs <scenario> <arquivo-properties>');
  process.exit(1);
}

const propertyFile = path.resolve(repoRoot, propertyFileArgument);
const testPlan = path.resolve(repoRoot, 'tests', 'jmeter', 'blazedemo-flight-purchase.jmx');
const reportRoot = path.resolve(repoRoot, 'reports', scenario);
const dashboardDir = path.resolve(reportRoot, 'dashboard');
const resultsFile = path.resolve(reportRoot, 'results.jtl');
const summaryJsonFile = path.resolve(reportRoot, 'summary.json');
const summaryMdFile = path.resolve(reportRoot, 'summary.md');
const renderedTestPlan = path.resolve(reportRoot, 'blazedemo-flight-purchase.rendered.jmx');

const properties = readProperties(propertyFile);
const targetTransactionsPerMinute = Number(properties.target_transactions_per_minute || 0);
const targetHttpRps = Number(((targetTransactionsPerMinute * HTTP_SAMPLES_PER_TRANSACTION) / 60).toFixed(2));
const excludeInitialSeconds = Number(properties.analysis_exclude_initial_seconds || 0);

rmSync(reportRoot, { recursive: true, force: true });
mkdirSync(reportRoot, { recursive: true });

const targetThroughputValue = Number(targetTransactionsPerMinute.toFixed(1));
renderTestPlan(testPlan, renderedTestPlan, targetThroughputValue);

const jmeterExecutable = findJMeterExecutable();
const javaHome = findJavaHome();
const env = buildEnvironment(javaHome, path.dirname(jmeterExecutable));

console.log(`Cenario: ${scenario}`);
console.log(`JMeter: ${jmeterExecutable}`);
console.log(`JAVA_HOME: ${javaHome}`);
console.log(`Plano: ${renderedTestPlan}`);
console.log(`Properties: ${propertyFile}`);
console.log(`Saida: ${reportRoot}`);

const jmeterArgs = [
  '-n',
  '-t', renderedTestPlan,
  '-q', propertyFile,
  '-l', resultsFile,
  '-e',
  '-o', dashboardDir,
  '-Jjmeter.save.saveservice.output_format=csv',
  '-Jjmeter.save.saveservice.print_field_names=true',
  '-Jjmeter.save.saveservice.timestamp_format=ms',
  '-Jjmeter.save.saveservice.label=true',
  '-Jjmeter.save.saveservice.response_code=true',
  '-Jjmeter.save.saveservice.response_message=true',
  '-Jjmeter.save.saveservice.successful=true',
  '-Jjmeter.save.saveservice.thread_name=true',
  '-Jjmeter.save.saveservice.data_type=true',
  '-Jjmeter.save.saveservice.assertion_results_failure_message=true',
  '-Jjmeter.save.saveservice.bytes=true',
  '-Jjmeter.save.saveservice.sent_bytes=true',
  '-Jjmeter.save.saveservice.latency=true',
  '-Jjmeter.save.saveservice.connect_time=true',
  '-Jjmeter.save.saveservice.sample_count=true',
  '-Jjmeter.save.saveservice.error_count=true',
  '-Jjmeter.save.saveservice.hostname=true',
  '-Jjmeter.save.saveservice.idle_time=true',
  '-Jjmeter.save.saveservice.thread_counts=true'
];

const execution = spawnSync(jmeterExecutable, jmeterArgs, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (execution.status !== 0) {
  process.exit(execution.status ?? 1);
}

if (!existsSync(resultsFile)) {
  console.error('A execucao do JMeter terminou sem gerar o arquivo results.jtl.');
  process.exit(1);
}

const summary = analyzeResults(resultsFile, targetHttpRps, excludeInitialSeconds, properties);

writeFileSync(summaryJsonFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
writeFileSync(summaryMdFile, renderMarkdownSummary(summary, scenario, properties), 'utf8');

localizeDashboard(dashboardDir, resultsFile, summaryJsonFile);

console.log('Resumo da execucao:');
console.log(JSON.stringify(summary, null, 2));

function readProperties(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function findJMeterExecutable() {
  const candidates = [
    process.env.JMETER_HOME ? path.join(process.env.JMETER_HOME, 'bin', platformExecutable('jmeter')) : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'JMeter', 'bin', platformExecutable('jmeter')) : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'JMeter', 'bin', platformExecutable('jmeter')) : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Apache', 'JMeter', 'bin', platformExecutable('jmeter')) : null
  ].filter(Boolean);

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error('Nao foi possivel localizar o executavel do JMeter. Defina JMETER_HOME se necessario.');
  }

  return match;
}

function findJavaHome() {
  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', platformExecutable('java')))) {
    return process.env.JAVA_HOME;
  }

  const candidates = [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Microsoft', 'jdk-21.0.10.7-hotspot') : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Eclipse Adoptium', 'jdk-21.0.10.7-hotspot') : null
  ].filter(Boolean);

  const match = candidates.find((candidate) => existsSync(path.join(candidate, 'bin', platformExecutable('java'))));
  if (!match) {
    throw new Error('Nao foi possivel localizar o Java. Defina JAVA_HOME se necessario.');
  }

  return match;
}

function platformExecutable(commandName) {
  if (process.platform !== 'win32') {
    return commandName;
  }

  if (commandName === 'java') {
    return 'java.exe';
  }

  return `${commandName}.bat`;
}

function buildEnvironment(javaHome, jmeterBinDirectory) {
  const separator = process.platform === 'win32' ? ';' : ':';
  const javaBin = path.join(javaHome, 'bin');

  return {
    ...process.env,
    JAVA_HOME: javaHome,
    JMETER_HOME: path.resolve(jmeterBinDirectory, '..'),
    PATH: `${javaBin}${separator}${jmeterBinDirectory}${separator}${process.env.PATH || ''}`
  };
}

function renderTestPlan(sourceFile, targetFile, throughputValue) {
  const template = readFileSync(sourceFile, 'utf8');
  const rendered = template.replace('<value>3750.0</value>', `<value>${throughputValue}</value>`);
  writeFileSync(targetFile, rendered, 'utf8');
}

function localizeDashboard(targetDashboardDir, currentResultsFile, currentSummaryJsonFile) {
  const localizationScript = path.resolve(repoRoot, 'scripts', 'localize-jmeter-dashboard.mjs');
  const localization = spawnSync(process.execPath, [localizationScript, targetDashboardDir, currentResultsFile, currentSummaryJsonFile], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  });

  if (localization.status !== 0) {
    console.error('Falha ao localizar o dashboard do JMeter para PT-BR.');
    process.exit(localization.status ?? 1);
  }
}

function analyzeResults(filePath, expectedHttpRps, warmupSeconds, currentProperties) {
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length <= 1) {
    throw new Error('O arquivo JTL nao possui amostras suficientes para analise.');
  }

  const headers = parseCsvLine(lines[0]);
  const samples = lines.slice(1).map((line) => createSample(headers, line));
  const testStart = Math.min(...samples.map((sample) => sample.timestamp));
  const warmupThreshold = testStart + (warmupSeconds * 1000);
  const filteredSamples = samples.filter((sample) => sample.timestamp >= warmupThreshold);
  const effectiveSamples = filteredSamples.length > 0 ? filteredSamples : samples;
  const samplesByLabel = groupSamplesByLabel(effectiveSamples);
  const allHttpSamples = effectiveSamples.filter((sample) => sample.label !== BUSINESS_LABEL);
  const completedBusinessSamples = samples
    .filter((sample) => sample.label === BUSINESS_LABEL)
    .filter((sample) => sample.isCompleteTransaction)
  const businessSamplesAfterWarmup = completedBusinessSamples
    .filter((sample) => (sample.timestamp + sample.elapsed) >= warmupThreshold);
  const businessSamples = businessSamplesAfterWarmup.length > 0 ? businessSamplesAfterWarmup : completedBusinessSamples;

  const filteredStart = Math.min(...effectiveSamples.map((sample) => sample.timestamp));
  const testEnd = Math.max(...effectiveSamples.map((sample) => sample.timestamp + sample.elapsed));
  const totalDurationSeconds = Math.max((testEnd - filteredStart) / 1000, 1);
  const scenarioStart = new Date(testStart);
  const scenarioEnd = new Date(Math.max(...samples.map((sample) => sample.timestamp + sample.elapsed)));

  const requestMetrics = buildMetrics(allHttpSamples, totalDurationSeconds);
  const businessMetrics = buildMetrics(businessSamples, totalDurationSeconds);

  return {
    scenario: scenario,
    testName: currentProperties.test_name,
    targetHttpRps: expectedHttpRps,
    measuredHttpRps: requestMetrics.throughput,
    acceptanceCriteria: {
      minimumHttpRps: 250,
      p90UnderMs: 2000,
      zeroErrors: true
    },
    acceptanceSatisfied: requestMetrics.throughput >= 250 && businessMetrics.p90 < 2000 && businessMetrics.errorRate === 0,
    transactionLabel: BUSINESS_LABEL,
    warmupExcludedSeconds: warmupSeconds,
    testWindowSeconds: round(totalDurationSeconds),
    execution: {
      startTimestamp: testStart,
      endTimestamp: scenarioEnd.getTime(),
      startAt: formatDateTimePtBr(scenarioStart),
      endAt: formatDateTimePtBr(scenarioEnd),
      totalDurationHuman: formatDurationPtBr(scenarioEnd.getTime() - testStart)
    },
    requestMetrics,
    businessMetrics,
    samplesByLabel: Object.fromEntries(
      Array.from(samplesByLabel.entries()).map(([label, groupedSamples]) => [
        label,
        buildMetrics(label === BUSINESS_LABEL ? businessSamples : groupedSamples, totalDurationSeconds)
      ])
    )
  };
}

function createSample(headers, line) {
  const values = parseCsvLine(line);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

  return {
    label: row.label,
    timestamp: Number(row.timeStamp),
    elapsed: Number(row.elapsed),
    success: (row.success || row.successful) === 'true',
    responseCode: row.responseCode,
    responseMessage: row.responseMessage || '',
    threadName: row.threadName,
    isCompleteTransaction: row.label === BUSINESS_LABEL
      ? (row.responseMessage || '').includes('Number of samples in transaction') && Number(row.elapsed) > 0
      : true
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === ',' && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function groupSamplesByLabel(samples) {
  const grouped = new Map();

  for (const sample of samples) {
    const current = grouped.get(sample.label) || [];
    current.push(sample);
    grouped.set(sample.label, current);
  }

  return grouped;
}

function buildMetrics(samples, totalDurationSeconds) {
  if (samples.length === 0) {
    return {
      count: 0,
      errors: 0,
      errorRate: 1,
      throughput: 0,
      avg: 0,
      p90: 0,
      min: 0,
      max: 0
    };
  }

  const durations = samples.map((sample) => sample.elapsed).sort((left, right) => left - right);
  const errors = samples.filter((sample) => !sample.success).length;
  const sum = durations.reduce((accumulator, value) => accumulator + value, 0);

  return {
    count: samples.length,
    errors,
    errorRate: round(errors / samples.length),
    throughput: round(samples.length / totalDurationSeconds),
    avg: round(sum / samples.length),
    p90: round(percentile(durations, 0.9)),
    min: durations[0],
    max: durations[durations.length - 1]
  };
}

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index];
}

function round(value) {
  return Number(value.toFixed(2));
}

function formatDateTimePtBr(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date);
}

function formatDurationPtBr(durationInMs) {
  const totalSeconds = Math.max(0, Math.floor(durationInMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function renderMarkdownSummary(summary, currentScenario, currentProperties) {
  const acceptanceStatus = summary.acceptanceSatisfied ? 'Satisfatorio' : 'Nao satisfatorio';

  return [
    `# Relatorio ${currentScenario}`,
    '',
    `- Cenario: ${currentScenario}`,
    `- Nome do teste: ${currentProperties.test_name}`,
    `- Inicio: ${summary.execution.startAt}`,
    `- Fim: ${summary.execution.endAt}`,
    `- Duracao total: ${summary.execution.totalDurationHuman}`,
    `- Usuarios: ${currentProperties.users}`,
    `- Ramp-up: ${currentProperties.ramp_up_seconds}s`,
    `- Duracao: ${currentProperties.duration_seconds}s`,
    `- Alvo de throughput HTTP: ${summary.targetHttpRps} req/s`,
    `- Throughput HTTP medido: ${summary.measuredHttpRps} req/s`,
    `- Warm-up desconsiderado na analise: ${summary.warmupExcludedSeconds}s`,
    `- Percentil 90 da transacao: ${summary.businessMetrics.p90} ms`,
    `- Taxa de erro da transacao: ${(summary.businessMetrics.errorRate * 100).toFixed(2)}%`,
    `- Status do criterio de aceitacao: ${acceptanceStatus}`,
    '',
    '## Conclusao',
    '',
    summary.acceptanceSatisfied
      ? 'O criterio foi atendido porque o throughput HTTP ficou acima de 250 req/s, o percentil 90 da transacao ficou abaixo de 2 segundos e nao houve erros na confirmacao da compra.'
      : 'O criterio nao foi atendido porque pelo menos um dos indicadores ficou abaixo do esperado. Consulte os detalhes do resumo JSON e do dashboard HTML para identificar o gargalo.'
  ].join('\n');
}