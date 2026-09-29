---
nome: Nota de Triagem de Alerta
descricao: Converte um alerta bruto de monitoração em nota de triagem padronizada de 5 linhas, com impacto, hipótese, ação imediata e critério de escalação
versao: 1.0.0
tags: [incidentes, triagem, plantao, alerta]
inputs:
  - nome: alerta_cru
    descricao: Texto bruto do alerta, direto da ferramenta de monitoração (obrigatório).
  - nome: mapa_escalacao
    descricao: Tabela opcional de roteamento sistema para handle. Se vazio, o prompt usa o mapa padrão interno.
---

# Nota de Triagem de Alerta

## Objetivo

Padroniza a nota que o plantonista abre a cada alerta, para que quem assume o turno seguinte leia sempre a mesma estrutura. A saída tem exatamente cinco linhas rotuladas e o critério de escalação carrega handle, condição medível e prazo derivado por regra, não por julgamento.

## Quando usar

- Alerta de monitoração precisa virar registro legível antes da investigação começar.
- Passagem de turno depende de notas com formato uniforme.
- O plantão precisa de um prazo de escalação consistente para o mesmo tipo de alerta.

## Exemplo de uso

Com `{{alerta_cru}}` = `2026-05-13 03:11:00 UTC [Relay] ingest reject rate 6% for 8min, tenant wakanda-systems, buffer saturated after deploy 02:55` e `{{mapa_escalacao}}` vazio:

```
ALERTA: Relay - taxa de rejeição de ingestão em 6% por 8min
IMPACTO: tenant wakanda-systems sofrendo rejeição e impedido de enviar dados de telemetria
HIPÓTESE INICIAL: saturação do buffer de ingestão após o deploy realizado às 02:55
AÇÃO IMEDIATA: reverter o deploy das 02:55 para tentar recuperar a capacidade do buffer
ESCALAR PARA: @relay-core se a taxa de rejeição continuar em 6% em 10min
```

## Limitações conhecidas

- O prazo de escalação sai de uma regra de três faixas baseada na reversibilidade do dano. Alerta que não se encaixe nas três faixas força o modelo a aproximar.
- A ação imediata não pode citar ferramenta ausente do alerta e do mapa, então ela descreve a operação em vez de nomear o sistema de deploy. Isso é proposital, mas exige que o plantonista saiba traduzir.
- Os rótulos carregam acento por exigência do padrão interno. Testes de string sobre a saída precisam usar a mesma forma de normalização Unicode.
- Os três exemplos de formato embutidos no prompt custam cerca de 225 tokens por chamada. Medido, isso representa 0,34% de um orçamento de US$ 0,01 por chamada.
