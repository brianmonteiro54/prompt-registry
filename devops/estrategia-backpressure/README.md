---
nome: Estratégia de Backpressure
descricao: Apoia decisão de arquitetura sob restrições em conflito comparando opções de contenção de carga, com aritmética de capacidade, matriz de restrições e análise de sensibilidade
versao: 1.0.0
tags: [arquitetura, backpressure, capacidade, decisao]
inputs:
  - nome: estado_atual
    descricao: Capacidade atual, taxa de pico observada, retenção e consumidores do componente.
  - nome: restricoes
    descricao: SLAs de negócio, restrições financeiras e requisitos não negociáveis.
  - nome: opcoes_candidatas
    descricao: (Opcional) Caminhos já mapeados pelo time. Se vazio, o prompt deriva as opções.
---

# Estratégia de Backpressure

## Objetivo

Força a comparação de mais de um caminho técnico antes de recomendar, em vez de produzir uma recomendação única disfarçada de análise. O prompt começa dimensionando o problema em números — déficit, volume acumulado e piso físico de drenagem — e usa esse piso para eliminar arranjos que a aritmética já proíbe.

## Quando usar

- Existe mais de um caminho defensável e a decisão é cara de reverter.
- As restrições estão em conflito e é preciso saber qual delas elimina opção e qual apenas penaliza.
- A recomendação vai ser questionada e o raciocínio precisa estar auditável.

## Exemplo de uso

Com `{{estado_atual}}` declarando capacidade sustentada de 180k msgs/s e pico observado de 320k por 25 minutos, a seção de abertura calcula:

```
Déficit = 320.000 - 180.000 = 140.000 msgs/s
Volume Acumulado = 140.000 x 1.500 s = 210.000.000 msgs
Piso Físico de Drenagem = 210.000.000 / 180.000 = ~19,4 minutos

VEREDITO: o piso físico já VIOLA o SLA temporal de 15 min do consumidor de ingestão.
Nenhuma estratégia de priorização, isolamento ou reordenação resolve aquele SLA.
Apenas o aumento de capacidade resolve.
```

Seguem a matriz opção por restrição, as opções eliminadas, a recomendação com ordem justificada, a sensibilidade da decisão e as lacunas.

## Limitações conhecidas

- O piso físico assume dedicação total e zero chegada nova. Ele só serve para reprovar viabilidade, nunca para aprovar — regra declarada no prompt, mas que exige leitura atenta de quem consome a saída.
- Pendência conhecida (v1.0.1): na execução registrada, células da matriz receberam ATENDE dependendo de lacunas que o próprio output havia declarado. A correção é proibir ATENDE quando o veredito depende de lacuna aberta, forçando CONDICIONAL com a lacuna nomeada.
- O prompt não presume tecnologia, então recomendação que dependa de recurso específico de um produto sai como premissa declarada e precisa de validação local.
