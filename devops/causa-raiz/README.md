---
nome: Análise de Causa-Raiz
descricao: Cruza configuração, métricas e logs para diagnosticar a causa-raiz de uma degradação, separando causa de consequência e declarando o que os dados não permitem concluir
versao: 1.0.0
tags: [rca, incidentes, sre, correlacao]
inputs:
  - nome: config
    descricao: Arquivo de configuração do serviço cobrindo capacidade, limites e agendamento de jobs.
  - nome: metricas
    descricao: Série temporal em texto com as métricas principais do serviço na janela do incidente.
  - nome: logs
    descricao: Trecho de log do serviço ou do nó afetado, cobrindo a mesma janela de tempo das métricas.
---

# Análise de Causa-Raiz

## Objetivo

Conduz o raciocínio de um serviço degradado até a causa-raiz, e não até a lista de sintomas. O método é imposto em nove etapas: conferir a config contra a realidade observada, fazer a aritmética temporal de jobs agendados, ordenar sinais no tempo, nomear o recurso escasso, classificar cada sinal como causa, efeito ou contexto, testar hipóteses concorrentes e declarar as lacunas.

## Quando usar

- Serviço em produção degradou e existem artefatos de fontes diferentes, sem conclusão evidente.
- É preciso separar o que causou do que apenas acompanhou a degradação.
- A ação corretiva vai custar caro e precisa estar ancorada em evidência citável.

## Exemplo de uso

Com a config de um cluster de busca declarando job agendado às 02:00 com duração média de 90 minutos, métricas de duas horas e log do nó na mesma janela, a saída abre com:

```
CAUSA RAIZ
O job de reindexação agendado na config para 02:00 estagnou, operando mais de 4,5 horas
além de sua duração média esperada (log de 08:02 indica apenas 38% concluído). (...)
Confiança: MEDIA - Motivo: consistência cronológica interna forte entre métricas e logs,
mas a correlação depende de assumir fusos horários idênticos e o impacto real é
indeterminado sem mapa de dependências.
```

Seguem as seções `CADEIA CAUSAL`, `SINAIS OBSERVADOS` com o papel de cada sinal, `HIPOTESES CONCORRENTES`, `ACAO` separada em contenção e correção de fundo, e `LACUNAS` com no mínimo três itens.

## Limitações conhecidas

- O piso de três lacunas pode induzir enchimento quando o pacote de artefatos for realmente completo.
- A aritmética temporal exige cálculo explícito e é sensível a modelo: em modelo otimizado para velocidade o risco de erro na conta base aumenta, e a conta base sustenta todo o diagnóstico.
- Pendência conhecida (v1.0.1): a coluna de papel do sinal declara vocabulário fechado de três valores, e outra regra exige marcar hipótese onde falta sustentação. Quando o papel depende de premissa não sustentada, as duas regras colidem e a execução registrada emitiu um valor fora do vocabulário. A correção é permitir sufixo, no formato `CONTEXTO (hipótese)`.
