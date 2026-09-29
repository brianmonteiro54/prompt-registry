---
nome: Plano de Migração Faseado
descricao: Transforma um diagnóstico de acoplamento em fases com critério objetivo de avanço e ponto de reversão próprio, sem virada única
versao: 1.0.0
tags: [arquitetura, migracao, planejamento, reversibilidade]
inputs:
  - nome: diagnostico
    descricao: Saída integral do prompt diagnostico-de-acoplamento.
  - nome: requisitos
    descricao: Restrições e objetivos não negociáveis da migração.
---

# Plano de Migração Faseado

## Objetivo

Segundo elo da cadeia. Deriva as fases dos riscos e acoplamentos que o diagnóstico levantou, exigindo que cada fase tenha ponto de reversão independente das anteriores, continuidade declarada por consumidor e critério objetivo para autorizar a fase seguinte. A primeira fase não toca o caminho de produção.

## Quando usar

- Depois de rodar `diagnostico-de-acoplamento` e revisar a saída dele.
- Quando a migração precisa avançar em passos auditáveis e poder voltar atrás em qualquer ponto.
- Quando existe pressão por virada única e é preciso um plano que a torne desnecessária.

## Exemplo de uso

O prompt não refaz o diagnóstico: ele usa a classificação recebida como dada e, quando discorda, declara em seção própria. Na execução registrada o diagnóstico continha um erro de classificação e o plano o recusou explicitamente:

```
DISCORDANCIAS DO DIAGNOSTICO
O diagnóstico classificou a ingestão como "EXIGE LOTE COMPLETO" com base no fato de que
hoje roda em cron. Discordamos: rodar em lote hoje é escolha de implementação atual, não
propriedade inerente. O verdadeiro desafio é a garantia de completude exigida pelos
consumidores que dependem de janelas fechadas.
```

## Limitações conhecidas

- Pendência conhecida (v1.0.1): a regra manda marcar BLOQUEADA a fase que depende de lacuna aberta, e na execução registrada a dependência foi declarada sem o marcador, deixando indefinido se a fase pode ser executada. A correção é tornar isso binário — ou marca BLOQUEADA, ou explica por que a lacuna não bloqueia.
- Pendência conhecida (v1.0.1): a seção de premissas herdadas listou uma classificação que a seção seguinte rejeitava. Premissa herdada deve listar só o que foi usado como base.
- O prompt herda os erros do diagnóstico que não detectar. A seção de discordâncias é o mecanismo de defesa, e ela depende de revisão humana entre os dois elos para ter valor.
