# DevOps

Prompts voltados a **infraestrutura, automação e operação** de sistemas: pipelines de CI/CD, containers, orquestração, provisionamento, observabilidade, confiabilidade e segurança operacional.

## Escopo

Entram aqui prompts relacionados a:

- Pipelines de CI/CD (GitHub Actions, GitLab CI, Jenkins etc.).
- Containers e orquestração (Docker, Kubernetes, Helm).
- Infraestrutura como código (Terraform, Pulumi, Ansible).
- Provedores de nuvem (AWS, GCP, Azure) e seus recursos.
- Observabilidade (logs, métricas, tracing, alertas, dashboards).
- Confiabilidade, SRE, postmortems e análise de incidentes.
- Segurança operacional (hardening, secrets, políticas de acesso).

## Fora de escopo

- Escrita de código de aplicação → usar `desenvolvimento/`.
- Conteúdo educacional sobre DevOps (aulas, artigos, vídeos) → usar `criacao-conteudo/`.

## Prompts

Os prompts desta categoria formam o **playbook de IA operacional da Aegis**, construído no Desafio 2 da
pós-graduação. Três deles (`diagnostico-de-acoplamento`, `plano-de-migracao-faseado` e
`detalhamento-de-fase`) formam uma **cadeia**: a saída integral de um é o parâmetro de entrada do
seguinte, e a ordem está declarada no `README.md` de cada um. Outros dois
(`networkpolicy-sentinel` e `revisao-de-networkpolicy`) formam um **par gerador/revisor** usado em
ciclo de verificação e refino.

Cada `README.md` de prompt traz a seção **Limitações conhecidas** preenchida com defeitos observados
em execução real, incluindo pendências marcadas como v1.0.1 que ainda não foram aplicadas.

- [triagem-de-pods](./triagem-de-pods/) — Recebe um snapshot de kubectl e devolve a triagem dos pods problemáticos com causa provável, evidência e próxima ação do plantão.
- [nota-de-triagem](./nota-de-triagem/) — Converte um alerta bruto de monitoração em nota de triagem padronizada de 5 linhas, com impacto, hipótese, ação imediata e critério de escalação.
- [causa-raiz](./causa-raiz/) — Cruza configuração, métricas e logs para diagnosticar a causa-raiz de uma degradação, separando causa de consequência e declarando o que os dados não permitem concluir.
- [estrategia-backpressure](./estrategia-backpressure/) — Apoia decisão de arquitetura sob restrições em conflito comparando opções de contenção de carga, com aritmética de capacidade, matriz de restrições e análise de sensibilidade.
- [diagnostico-de-acoplamento](./diagnostico-de-acoplamento/) — Mapeia consumidores, garantias implícitas, incrementalidade das etapas e riscos antes de planejar a migração de um pipeline de lote para contínuo.
- [plano-de-migracao-faseado](./plano-de-migracao-faseado/) — Transforma um diagnóstico de acoplamento em fases com critério objetivo de avanço e ponto de reversão próprio, sem virada única.
- [detalhamento-de-fase](./detalhamento-de-fase/) — Detalha uma única fase de um plano de migração em passos verificáveis, com critérios numéricos de aborto e reversão com perda declarada.
- [networkpolicy-sentinel](./networkpolicy-sentinel/) — Transforma um manifesto de NetworkPolicy permissivo em política endurecida contra um padrão de compliance e um mapa de identidade de serviços, devolvendo YAML puro.
- [revisao-de-networkpolicy](./revisao-de-networkpolicy/) — Revisa uma NetworkPolicy contra um padrão de compliance e um mapa de serviços, devolvendo veredito, perguntas de verificação derivadas do padrão e apontamentos numerados com severidade.
