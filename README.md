# Catálogo de prompts

Coleção de prompts em Markdown organizados por categoria/área de domínio. Cada prompt vive em sua própria pasta, contendo o arquivo `prompt.md` (texto puro, pronto para copiar e colar) e um `README.md` com metadados, variáveis e exemplos de uso.

Este repositório faz parte do material dos projetos da pós-graduação em AIOps e Inteligência Artificial com Engenharia Cloud: [pos.veronez.io/pos-aiops](https://pos.veronez.io/pos-aiops/).

Convenções de estrutura, nomenclatura e manutenção estão em [`CLAUDE.md`](./CLAUDE.md).

## Sobre este fork

Este fork é o **playbook de IA operacional da Aegis**, construído no Desafio 2 da pós-graduação a partir do template original. A Aegis é uma empresa fictícia de observabilidade, e o desafio parte de uma decisão: o uso de IA pelo time de engenharia não pode mais ser ad-hoc, com cada pessoa guardando o próprio prompt no histórico do chat. O playbook é a resposta — biblioteca versionada, testada e tratada como código.

Duas regras de método valem para todos os prompts deste fork:

1. **Todo prompt é parametrizável.** Ele recebe os dados variáveis por parâmetro — o snapshot, o alerta, os artefatos, o cenário — para que qualquer pessoa reuse o mesmo prompt trocando só a entrada. Os placeholders `{{...}}` do `prompt.md` e a lista `inputs` do frontmatter são a mesma coisa, agora versionada.
2. **Os prompts foram criados por meta-prompting.** Em vez de redigir cada palavra à mão, o processo foi dirigir um modelo para gerar e refinar o prompt, com curadoria humana em cima. O meta-prompt não entra no catálogo: o que entra é o prompt final.

Os prompts estão todos em [`devops/`](./devops/), e o `README.md` de cada um traz a seção **Limitações conhecidas** preenchida com defeitos observados em execução real — incluindo pendências marcadas como v1.0.1 que ainda não foram aplicadas, para não invalidar as execuções registradas na documentação do desafio.

## Como usar

1. Navegar até a categoria de interesse.
2. Abrir o `README.md` do prompt para entender objetivo, variáveis esperadas e limitações.
3. Copiar o conteúdo do `prompt.md` e substituir os placeholders `{{nome_variavel}}` pelos valores desejados.

## Adicionando um prompt

Use o slash command [`/catalogar`](./.claude/commands/catalogar.md) passando o texto do prompt como argumento. Ele analisa, propõe organização (categoria, slug, frontmatter) e, após sua aprovação, escreve os arquivos e atualiza os índices — sem commitar. Convenções completas em [`CLAUDE.md`](./CLAUDE.md).

## Categorias

### [Desenvolvimento](./desenvolvimento/)

Escrita, revisão e refatoração de código, design de APIs e arquitetura, debugging, testes e documentação técnica.

_Nenhum prompt cadastrado ainda._

### [DevOps](./devops/)

Pipelines de CI/CD, containers, orquestração, infraestrutura como código, observabilidade, SRE e segurança operacional.

- [triagem-de-pods](./devops/triagem-de-pods/) — Recebe um snapshot de kubectl e devolve a triagem dos pods problemáticos com causa provável, evidência e próxima ação do plantão.
- [nota-de-triagem](./devops/nota-de-triagem/) — Converte um alerta bruto de monitoração em nota de triagem padronizada de 5 linhas, com impacto, hipótese, ação imediata e critério de escalação.
- [causa-raiz](./devops/causa-raiz/) — Cruza configuração, métricas e logs para diagnosticar a causa-raiz de uma degradação, separando causa de consequência e declarando o que os dados não permitem concluir.
- [estrategia-backpressure](./devops/estrategia-backpressure/) — Apoia decisão de arquitetura sob restrições em conflito comparando opções de contenção de carga, com aritmética de capacidade, matriz de restrições e análise de sensibilidade.
- [diagnostico-de-acoplamento](./devops/diagnostico-de-acoplamento/) — Mapeia consumidores, garantias implícitas, incrementalidade das etapas e riscos antes de planejar a migração de um pipeline de lote para contínuo.
- [plano-de-migracao-faseado](./devops/plano-de-migracao-faseado/) — Transforma um diagnóstico de acoplamento em fases com critério objetivo de avanço e ponto de reversão próprio, sem virada única.
- [detalhamento-de-fase](./devops/detalhamento-de-fase/) — Detalha uma única fase de um plano de migração em passos verificáveis, com critérios numéricos de aborto e reversão com perda declarada.
- [networkpolicy-sentinel](./devops/networkpolicy-sentinel/) — Transforma um manifesto de NetworkPolicy permissivo em política endurecida contra um padrão de compliance e um mapa de identidade de serviços, devolvendo YAML puro.
- [revisao-de-networkpolicy](./devops/revisao-de-networkpolicy/) — Revisa uma NetworkPolicy contra um padrão de compliance e um mapa de serviços, devolvendo veredito, perguntas de verificação derivadas do padrão e apontamentos numerados com severidade.

### [Produtividade](./produtividade/)

Organização pessoal, gestão de tempo e tarefas, rotina, hábitos, foco e decisões sobre fluxo de trabalho individual.

_Nenhum prompt cadastrado ainda._

### [Finanças](./financas/)

Orçamento, investimentos, planejamento financeiro, impostos e apoio a decisões financeiras.

_Nenhum prompt cadastrado ainda._

### [Criação de Conteúdo](./criacao-conteudo/)

Roteiros, artigos, posts para redes sociais, material didático e copy de divulgação.

_Nenhum prompt cadastrado ainda._

<!--
Ao adicionar um prompt, substituir "Nenhum prompt cadastrado ainda" pela lista:

- [nome-do-prompt](./<slug-da-categoria>/<slug-do-prompt>/) — o que o prompt faz, em uma linha.
-->

## Contribuindo

Antes de adicionar ou alterar um prompt, revisar [`CLAUDE.md`](./CLAUDE.md) — a seção **Manutenção da documentação** lista todos os arquivos que precisam ser atualizados junto com a mudança (este índice incluso).
