---
nome: Diagnóstico de Acoplamento
descricao: Mapeia consumidores, garantias implícitas, incrementalidade das etapas e riscos antes de planejar a migração de um pipeline de lote para contínuo
versao: 1.0.0
tags: [arquitetura, migracao, dados, acoplamento]
inputs:
  - nome: estado_atual
    descricao: Descrição estruturada do pipeline atual, etapas, periodicidade e consumidores dependentes.
  - nome: requisitos
    descricao: Restrições e objetivos não negociáveis da migração para o modelo contínuo.
---

# Diagnóstico de Acoplamento

## Objetivo

Primeiro elo de uma cadeia de três prompts. Mapeia o que sustenta o sistema atual e o que a mudança de modelo ameaça, antes de qualquer plano. O erro que ele existe para evitar é começar a migração pelo motor e descobrir depois que um consumidor quebrou em silêncio.

## Quando usar

- Antes de planejar migração de lote para processamento contínuo.
- Quando existem consumidores que dependem de garantias que ninguém escreveu em lugar nenhum.
- Quando é preciso saber quais etapas de transformação toleram fatia parcial e quais exigem a janela completa.

## Exemplo de uso

A saída tem cinco seções de títulos fixos, e é o contrato de entrada do prompt `plano-de-migracao-faseado`. A tabela de riscos sai ordenada por raio de alcance, com risco silencioso antes de risco visível:

| Risco | Consumidores atingidos | Visível ou Silencioso |
|---|---|---|
| Divergência de dados contábeis por leitura prematura | faturamento | Silencioso |
| Alertas falsos por estado parcial de agregação | alerting | Visível |

## Limitações conhecidas

- Pendência conhecida (v1.0.1): o critério de classificação de etapa não separa propriedade inerente de escolha de implementação. Na execução registrada, a ingestão foi classificada como exigindo lote completo porque hoje roda em cron, o que contradiz o requisito principal da migração. O critério correto é se o resultado fica incorreto quando calculado sobre fatia parcial.
- Depende da qualidade da descrição do estado atual. Etapas descritas em bloco só podem ser classificadas em bloco, e o prompt marca isso como indeterminado em vez de chutar.
- A saída é consumida integralmente pelo elo seguinte. Editar a saída à mão antes de repassar quebra a rastreabilidade entre os dois documentos.
