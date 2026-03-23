# automation_perfo

Projeto de teste de performance para o desafio de compra de passagem aérea no BlazeDemo usando JMeter e Node.js 20+.

## Objetivo

Validar o fluxo Compra de passagem aérea - Passagem comprada com sucesso no sistema BlazeDemo.

URL alvo:

- https://www.blazedemo.com

Cenário validado:

- busca de voos
- seleção de voo
- preenchimento do formulário de compra
- confirmação com sucesso da compra contendo PendingCapture

## Estrutura

- config: propriedades por cenário de execução
- data: massa de dados CSV para o fluxo de compra
- features/performance: documentação do comportamento em Gherkin
- reports: relatórios e dashboards gerados nas execuções
- scripts: orquestração da execução e análise dos resultados
- tests/jmeter: plano JMeter do fluxo de compra

## Pré-requisitos

- Node.js 20 ou superior
- Java 21 ou superior
- Apache JMeter 5.6.3 ou superior

## Instalação local

No ambiente atual foram utilizados:

- Node.js 22.18.0
- npm 10.9.3
- Java Microsoft OpenJDK 21
- Apache JMeter 5.6.3

Exemplo de instalação no Windows com winget:

```powershell
winget install --id DEVCOM.JMeter --exact --accept-package-agreements --accept-source-agreements --disable-interactivity
```

## Execução

### Smoke test

```bash
npm run test:smoke
```

### Teste de carga

```bash
npm run test:load
```

### Teste de pico

```bash
npm run test:spike
```

### Suite completa

```bash
npm run test:all
```

### Relatório consolidado de matriz

```bash
npm run report:matrix
```

Cada execução gera os artefatos abaixo em reports/<cenario>:

- index.html: relatorio executivo HTML do cenario
- results.jtl: resultados brutos do JMeter
- dashboard: dashboard HTML do JMeter
- summary.json: resumo numérico consolidado
- summary.md: síntese em Markdown para anexar no desafio

## Abertura dos relatórios HTML

Smoke:

- [reports/smoke/index.html](reports/smoke/index.html)

Carga:

- [reports/load/index.html](reports/load/index.html)

Pico:

- [reports/spike/index.html](reports/spike/index.html)

Dashboards tecnicos do JMeter:

- [reports/smoke/dashboard/index.html](reports/smoke/dashboard/index.html)
- [reports/load/dashboard/index.html](reports/load/dashboard/index.html)
- [reports/spike/dashboard/index.html](reports/spike/dashboard/index.html)

Exemplo para abrir localmente no Windows:

```powershell
Start-Process "C:\Users\HP\OneDrive\Desktop\automation_test\automation_perfo\reports\load\dashboard\index.html"
```

## Pipeline diária

O repositório agora possui uma workflow GitHub Actions em [.github/workflows/daily-performance.yml](.github/workflows/daily-performance.yml).

Comportamento da pipeline:

- executa automaticamente a cada push na branch main
- executa diariamente às 08:00 no horário de Brasília
- usa o cron 11:00 UTC no GitHub Actions
- roda em Windows, macOS e Linux
- executa load test por padrão no push e no agendamento, com alvo configurado de 250 req/s
- permite execução manual via workflow_dispatch com seleção de cenário smoke, load ou spike
- publica um HTML consolidado com os 3 sistemas operacionais

Artefatos gerados pela pipeline:

- um artifact por sistema operacional com summary.json, summary.md e dashboard HTML
- um artifact consolidado contendo:
	- report/index.html com a visão única dos 3 sistemas
	- dashboards individuais por sistema operacional

Como abrir corretamente o relatório consolidado:

- faça o download e extraia o artifact consolidated-html-report inteiro
- abra o arquivo consolidated/report/index.html mantendo as pastas linux, windows e macos no mesmo nível de consolidated/report
- os links Abrir relatório individual do HTML consolidado dependem dessa estrutura relativa para funcionar

Observação:

- o GitHub Actions usa UTC em cron; 08:00 de Brasília foi configurado como 11:00 UTC

## Cenários cobertos

- Busca de voos pela origem e destino
- Seleção do primeiro voo disponível retornado pela busca
- Preenchimento do formulário de compra
- Confirmação da compra com status PendingCapture

## Critério de aceitação

- 250 requisições por segundo
- Percentil 90 da transação Compra de passagem - sucesso abaixo de 2 segundos

## Leitura executiva dos relatórios

Os relatórios HTML executivos passaram a apresentar o resultado do teste em três perguntas objetivas, pensadas para leitura de gestor, recrutador ou avaliador técnico.

- Escalabilidade: responde se o ambiente sustentou ou não a vazão mínima exigida pelo desafio
- Performance: responde se o tempo de resposta da transação principal ficou dentro do limite definido
- Estabilidade: responde se o comportamento permaneceu consistente sob carga, sem erro e sem sinais relevantes de degradação entre as etapas

Regras usadas nessa leitura:

- Escalabilidade usa principalmente throughput HTTP medido versus meta mínima do desafio e versus alvo configurado do cenário
- Performance usa principalmente o percentil 90 da transação de negócio versus o limite de 2 segundos
- Estabilidade usa taxa de erro e consistência aproximada entre as etapas HTTP observadas no teste

Tratamento do smoke test:

- o smoke aparece como leitura técnica, sem conclusão de capacidade
- isso acontece porque o smoke foi desenhado para validar fluxo, dados e instrumentação, não para comprovar alta carga

## Relatório de execução

### Smoke test

Objetivo:

- validar estrutura do plano, fluxo funcional e geração de dashboard

Resultado:

- início: 23/03/2026, 01:09:16
- fim: 23/03/2026, 01:09:46
- duração total: 30s
- throughput HTTP medido: 2.02 req/s
- percentil 90 da transação de negócio: 2059 ms
- taxa de erro: 0%

Conclusão:

- o smoke serviu para validar o fluxo e os relatórios
- não foi desenhado para atender o critério de aceitação de 250 req/s

### Teste de carga

Configuração executada:

- usuários: 350
- ramp-up: 60s
- duração: 300s
- alvo configurado: 3750 transações por minuto
- equivalente teórico: 250 req/s considerando 4 requisições HTTP por jornada completa

Resultado medido:

- início: 23/03/2026, 02:52:13
- fim: 23/03/2026, 02:57:13
- duração total: 5min 0s
- throughput HTTP medido: 62.46 req/s
- percentil 90 da transação de negócio: 1377 ms
- taxa de erro da transação: 0%
- compras concluídas no período analisado: 3433

Leitura do resultado:

- o percentil 90 da transação ficou abaixo de 2 segundos
- a estabilidade funcional foi mantida, sem erros
- o throughput sustentado ficou muito abaixo das 250 req/s exigidas

Conclusão do teste de carga:

- status no desafio: Reprovado no desafio
- o principal motivo foi a vazão sustentada de aproximadamente 62.46 req/s, inferior ao mínimo de 250 req/s
- apesar disso, o comportamento de latência e a ausência de erros indicam que o gargalo observado está ligado à capacidade de throughput do ambiente sob teste e ou do ambiente local de execução da carga, não a uma falha funcional do fluxo

### Teste de pico

Configuração executada:

- usuários: 600
- ramp-up: 20s
- duração: 180s
- alvo configurado: 7200 transações por minuto
- equivalente teórico: 480 req/s considerando 4 requisições HTTP por jornada completa

Resultado medido:

- início: 23/03/2026, 01:31:47
- fim: 23/03/2026, 01:34:48
- duração total: 3min 0s
- throughput HTTP medido: 119.85 req/s
- percentil 90 da transação de negócio: 1404 ms
- taxa de erro da transação: 0%
- compras concluídas no período analisado: 4261

Leitura do resultado:

- o percentil 90 da transação permaneceu abaixo de 2 segundos
- a estabilidade funcional foi mantida, sem erros
- o throughput sustentado cresceu em relação ao teste de carga, mas ainda ficou abaixo das 250 req/s exigidas

Conclusão do teste de pico:

- status no desafio: Reprovado no desafio
- mesmo com maior agressividade de entrada, o sistema manteve boa latência e ausência de erros
- a principal limitação continuou sendo a vazão sustentada, com aproximadamente 119.85 req/s, inferior ao mínimo de 250 req/s

Artefatos gerados:

- [reports/spike/dashboard/index.html](reports/spike/dashboard/index.html)
- [reports/spike/summary.json](reports/spike/summary.json)
- [reports/spike/summary.md](reports/spike/summary.md)

## Parecer final do desafio

Com base na execução real consolidada neste repositório:

- o fluxo de compra foi automatizado com sucesso em JMeter
- os relatórios em HTML e resumos analíticos foram gerados com localização em PT-BR
- o critério de latência foi atendido nas execuções de carga e pico realizadas
- o critério de throughput de 250 req/s não foi atendido nem no teste de carga nem no teste de pico

Status final no desafio: Reprovado no desafio.

## Gherkin do cenário

Arquivo:

- [features/performance/blazedemo-flight-purchase.feature](features/performance/blazedemo-flight-purchase.feature)

## Observações

- O throughput foi modelado em transações por minuto e convertido para requisições HTTP por segundo considerando 4 requisições por iteração completa do fluxo.
- O plano usa um Transaction Controller para medir a jornada completa de compra como uma transação de negócio.
- O runner em Node localiza automaticamente JMeter e Java nas instalações padrão do Windows.
- O dashboard HTML gerado pelo JMeter é localizado automaticamente para PT-BR após cada execução.
- Os campos de início, fim e duração dos dashboards HTML são pós-processados para exibição em formato brasileiro.
- O teste de pico mostrou melhora de throughput frente ao teste de carga, mas ainda abaixo da meta contratada pelo desafio.