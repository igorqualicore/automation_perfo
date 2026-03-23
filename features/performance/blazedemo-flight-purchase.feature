Funcionalidade: Compra de passagem aérea no BlazeDemo
  Como QA de performance
  Quero validar o fluxo de compra de passagem aérea
  Para medir se a aplicação suporta a vazão exigida pelo desafio

  Contexto:
    Dado que o ambiente alvo é https://www.blazedemo.com
    E que o fluxo exercitado representa uma compra concluída com sucesso

  Cenário: Teste de carga com 250 requisições por segundo
    Quando o teste de carga for executado com 3750 transações por minuto
    Então a aplicação deve sustentar ao menos 250 requisições por segundo
    E o percentil 90 da transação de compra deve ser inferior a 2 segundos
    E a compra deve ser confirmada com status PendingCapture

  Cenário: Teste de pico acima do critério mínimo
    Quando o teste de pico for executado com 6000 transações por minuto
    Então a aplicação deve ultrapassar 250 requisições por segundo
    E o percentil 90 da transação de compra deve permanecer inferior a 2 segundos
    E a compra deve ser confirmada com status PendingCapture
