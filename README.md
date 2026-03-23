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

Cada execução gera os artefatos abaixo em reports/<cenario>:

- results.jtl: resultados brutos do JMeter
- dashboard: dashboard HTML do JMeter
- summary.json: resumo numérico consolidado
- summary.md: síntese em Markdown para anexar no desafio

## Abertura dos relatórios HTML

Smoke:

- [reports/smoke/dashboard/index.html](reports/smoke/dashboard/index.html)

Carga:

- [reports/load/dashboard/index.html](reports/load/dashboard/index.html)

Exemplo para abrir localmente no Windows:

```powershell
Start-Process "C:\Users\HP\OneDrive\Desktop\automation_test\automation_perfo\reports\load\dashboard\index.html"
```

## Cenários cobertos

- Busca de voos pela origem e destino
- Seleção do primeiro voo disponível retornado pela busca
- Preenchimento do formulário de compra
- Confirmação da compra com status PendingCapture

## Critério de aceitação

- 250 requisições por segundo
- Percentil 90 da transação Compra de passagem - sucesso abaixo de 2 segundos

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
- alvo configurado: 4200 transações por minuto
- equivalente teórico: 280 req/s considerando 4 requisições HTTP por jornada completa

Resultado medido:

- início: 23/03/2026, 01:10:07
- fim: 23/03/2026, 01:15:07
- duração total: 5min 0s
- throughput HTTP medido: 69.94 req/s
- percentil 90 da transação de negócio: 1354 ms
- taxa de erro da transação: 0%
- compras concluídas no período analisado: 3875

Leitura do resultado:

- o percentil 90 da transação ficou abaixo de 2 segundos
- a estabilidade funcional foi mantida, sem erros
- o throughput sustentado ficou muito abaixo das 250 req/s exigidas

Conclusão do teste de carga:

- o critério de aceitação não foi atendido
- o principal motivo foi a vazão sustentada de aproximadamente 69.94 req/s, inferior ao mínimo de 250 req/s
- apesar disso, o comportamento de latência e a ausência de erros indicam que o gargalo observado está ligado à capacidade de throughput do ambiente sob teste e ou do ambiente local de execução da carga, não a uma falha funcional do fluxo

### Teste de pico

Status atual:

- cenário configurado no projeto
- execução final ainda não consolidada neste repositório

Comando pronto para execução:

```bash
npm run test:spike
```

Após a execução, os artefatos serão gerados em:

- [reports/spike/dashboard/index.html](reports/spike/dashboard/index.html)
- reports/spike/summary.json
- reports/spike/summary.md

## Parecer final do desafio

Com base na execução real consolidada neste repositório:

- o fluxo de compra foi automatizado com sucesso em JMeter
- os relatórios em HTML e resumos analíticos foram gerados com localização em PT-BR
- o critério de latência foi atendido no teste de carga executado
- o critério de throughput de 250 req/s não foi atendido na execução realizada

Portanto, com a evidência atual, o critério de aceitação do desafio foi não satisfatório.

## Gherkin do cenário

Arquivo:

- [features/performance/blazedemo-flight-purchase.feature](features/performance/blazedemo-flight-purchase.feature)

## Observações

- O throughput foi modelado em transações por minuto e convertido para requisições HTTP por segundo considerando 4 requisições por iteração completa do fluxo.
- O plano usa um Transaction Controller para medir a jornada completa de compra como uma transação de negócio.
- O runner em Node localiza automaticamente JMeter e Java nas instalações padrão do Windows.
- O dashboard HTML gerado pelo JMeter é localizado automaticamente para PT-BR após cada execução.
- Os campos de início, fim e duração dos dashboards HTML são pós-processados para exibição em formato brasileiro.
- O teste de pico ainda precisa ser executado para completar a comparação formal entre carga e pico no mesmo README.