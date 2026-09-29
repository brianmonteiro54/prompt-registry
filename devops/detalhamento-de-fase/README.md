---
nome: Detalhamento de Fase de Migração
descricao: Detalha uma única fase de um plano de migração em passos verificáveis, com critérios numéricos de aborto e reversão com perda declarada
versao: 1.0.0
tags: [arquitetura, migracao, runbook, execucao]
inputs:
  - nome: plano
    descricao: Saída integral do prompt plano-de-migracao-faseado.
  - nome: fase_escolhida
    descricao: Identificador ou número exato da fase do plano que será detalhada.
  - nome: requisitos
    descricao: Restrições operacionais e de negócio aplicáveis.
---

# Detalhamento de Fase de Migração

## Objetivo

Terceiro elo da cadeia. Detalha uma fase por execução, em profundidade, em vez de cobrir todas superficialmente — é reusado uma vez por fase. Confere o critério de conclusão que propõe contra o critério de avanço que o plano declarou, e exige que a reversão diga o que se perde.

## Quando usar

- Uma fase do plano vai entrar em execução e precisa de passo a passo verificável.
- É preciso saber, antes de começar, até onde dá para voltar sem desfazer a fase inteira.
- A fase precisa de gatilho objetivo de interrupção no meio do caminho.

## Exemplo de uso

Para a primeira fase de um plano de migração, a saída abre copiando o critério do plano e declarando se ele divergiu do critério proposto:

```
FASE DETALHADA
Fase escolhida: Fase 1 - Observabilidade e Dupla Gravação Paralela. Critério de avanço
definido no plano: paridade de dados verificada entre a saída sombra e o batch tradicional
por 48 horas contínuas. Divergência com o critério de conclusão proposto: Nenhuma.
```

Seguem pré-condições, passos com critério de verificação e marcação de reversibilidade isolada, validação da fase, reversão com janela e perda declarada, critérios de aborto e lacunas.

## Limitações conhecidas

- Pendência conhecida (v1.0.1): na execução registrada um passo recebeu critério de verificação idêntico ao critério de conclusão da fase, ou seja, verificação de 48 horas. Passo cuja verificação dura tanto quanto a fase não é passo executável e precisa de checkpoints intermediários.
- Pendência conhecida (v1.0.1): a reversão nomeou a perda mas tratou como irrelevante, sem reconhecer que o histórico perdido era a janela de evidência que destrava a fase. A correção é exigir a verificação explícita de se a perda inclui progresso em direção ao critério de avanço.
- Recusa a tarefa se a fase não existir no plano recebido, o que é intencional, mas exige que o identificador da fase seja copiado literalmente.
