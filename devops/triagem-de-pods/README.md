---
nome: Triagem de Pods
descricao: Recebe um snapshot de kubectl e devolve a triagem dos pods problemáticos com causa provável, evidência e próxima ação do plantão
versao: 1.0.0
tags: [kubernetes, sre, plantao, triagem]
inputs:
  - nome: snapshot
    descricao: Saída bruta e colada de comandos kubectl (get pods, describe, logs) coletada por quem tem acesso ao cluster.
---

# Triagem de Pods

## Objetivo

Dá ao plantonista uma triagem rápida e confiável da saúde dos pods de um namespace, a partir de um snapshot já coletado. Em vez de repetir a coluna STATUS, o prompt obriga o cruzamento de três camadas — listagem, `describe` e logs da aplicação — para chegar à causa provável de cada pod problemático, com a evidência que sustenta o diagnóstico e a próxima ação concreta.

## Quando usar

- Alerta de pod em falha chega no plantão e ninguém do time conhece o serviço em profundidade.
- É preciso decidir entre reiniciar, escalar ou investigar, com evidência em vez de intuição.
- Triagem precisa ser reproduzível entre plantonistas diferentes, com o mesmo critério.

## Exemplo de uso

Com `{{snapshot}}` contendo um pod em `CrashLoopBackOff` com `Last State: OOMKilled` e log de `out of memory`, a saída é:

```
VEREDITO: 1 POD(S) PROBLEMATICO(S)
POD: sentinel-api-7d9c8b6f4-h4m2t
SEVERIDADE: ALTA
SINTOMA: CrashLoopBackOff
CAUSA_RAIZ: OOMKilled - container encerrou por falta de memoria ao carregar cache
EVIDENCIA: Last State: Terminated Reason: OOMKilled e log [FATAL] out of memory
ACAO_RECOMENDADA: [AVISO DE IMPACTO] Aumentar limits de memoria do deployment apos avaliar uso.
CONFIANCA: ALTA - dados completos
```

Quando o snapshot não tem pod problemático, a saída é o veredito `NENHUM POD PROBLEMATICO` mais, no máximo, duas linhas de `OBSERVACOES`. Nenhum rótulo de diagnóstico aparece nesse caso, o que permite testar o caso saudável por ausência.

## Limitações conhecidas

- Depende de `metrics-server` no cluster se o snapshot incluir `kubectl top`.
- O critério de "pod problemático" cobre estado de infraestrutura, não saúde de aplicação: pod `Running` com deadlock ou devolvendo erro 500 é classificado como saudável.
- Snapshot muito extenso pode diluir a atenção do modelo. Truncar logs e omitir pods `Completed` antes de colar.
- Pendência conhecida (v1.0.1): a regra da tag `[AVISO DE IMPACTO]` enumera exemplos de ação destrutiva, e reverter imagem de deployment não está entre eles — na execução registrada essa ação saiu sem o aviso, apesar de disparar rollout.
