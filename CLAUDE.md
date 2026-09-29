# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Propósito do repositório

Catálogo de prompts em Markdown organizados por categoria / área de domínio. A qualidade é medida pela clareza dos prompts, pela consistência da estrutura e — para os prompts que têm suíte de avaliação — pelo resultado dos testes.

Não há código de aplicação neste repositório. Há, porém, **avaliação automatizada**: prompts de saída estruturada carregam um arquivo de configuração de testes ao lado do `prompt.md`, e um pipeline de CI executa essa suíte a cada alteração. Ver as seções "Estrutura obrigatória" e "Avaliação automatizada".

Compõe o material dos projetos da pós-graduação em AIOps e Inteligência Artificial com Engenharia Cloud ([pos.veronez.io/pos-aiops](https://pos.veronez.io/pos-aiops/)) — decisões de escopo e convenções devem considerar esse uso didático.

## Estrutura obrigatória

```
<categoria>/
  <nome-do-prompt>/
    prompt.md              # o prompt em si (conteúdo que será copiado/usado)
    README.md              # metadados e documentação do prompt
    promptfooconfig.yaml   # opcional: suíte de avaliação do prompt
```

Regras:
- **Categoria** = pasta na raiz (ex.: `engenharia-software/`, `escrita/`, `analise-dados/`). Uma categoria por área de domínio; não aninhar categorias.
- **Prompt** = subpasta dentro de uma categoria, nomeada em `kebab-case` descrevendo o objetivo do prompt.
- **`prompt.md`** contém o frontmatter YAML de metadados (ver seção "Frontmatter padrão") seguido do texto do prompt, preservado integralmente. Nenhuma explicação sobre o prompt entra nesse arquivo — apenas metadados estruturados + o texto que será usado.
- **`README.md`** começa com o **mesmo frontmatter** do `prompt.md` e, abaixo, traz a documentação humana do prompt: objetivo, quando usar, exemplo de uso/saída, limitações conhecidas.

A separação `prompt.md` × `README.md` continua intencional — `prompt.md` carrega o texto + metadados consumíveis por ferramentas; `README.md` adiciona a camada humana (objetivo, quando usar, exemplo, limitações) acima do mesmo frontmatter.

## Ao adicionar um novo prompt

Use o slash command [`/catalogar`](./.claude/commands/catalogar.md) sempre que possível — ele cuida da análise, classificação de categoria, geração do frontmatter e atualização dos 4 arquivos de documentação sob aprovação humana, sem fazer commit. Caso opte por fazer manualmente, siga as regras abaixo:

1. Escolher a categoria existente que melhor se encaixa antes de criar uma nova.
2. Se criar categoria nova, adicionar um `README.md` na raiz da categoria explicando o escopo dela.
3. Nomear a pasta do prompt descrevendo o *resultado*, não a técnica (ex.: `revisar-pr` é melhor que `prompt-chain-of-thought`).
4. Manter o **texto do prompt** autocontido — não referenciar o `README.md` nem outros arquivos do repo, pois o prompt será extraído do contexto. Essa regra se aplica ao corpo do prompt; o frontmatter é parte da estrutura e não viola a autocontenção.

## Convenções de conteúdo

- Prompts e documentação em **português (pt-BR)** por padrão, salvo quando o prompt for especificamente voltado a tooling/modelos que exijam inglês — nesse caso, registrar o motivo no `README.md`.
- Placeholders no corpo do `prompt.md` usar o formato `{{nome_variavel}}` e aparecer listados no campo `inputs` do frontmatter (mesma lista em `prompt.md` e `README.md`).

## Frontmatter padrão

Todo prompt tem um bloco de frontmatter YAML no topo de `prompt.md` **e** de `README.md`, idêntico nos dois arquivos. Campos obrigatórios:

```yaml
---
nome: Nome humano do prompt
descricao: Uma linha descrevendo o objetivo do prompt
versao: 1.0.0
tags: [tag1, tag2]
inputs:
  - nome: variavel_um
    descricao: O que essa variável representa
  - nome: variavel_dois
    descricao: O que essa variável representa
---
```

Regras:

- **`nome`**: título humano curto, em pt-BR, capitalizado. Não é o slug da pasta.
- **`descricao`**: uma única linha descrevendo o objetivo; é o texto que aparece no índice das categorias e no índice raiz.
- **`versao`**: semver `MAJOR.MINOR.PATCH`. Versão inicial de todo prompt é `1.0.0`. Incrementar manualmente ao evoluir.
- **`tags`**: 2 a 5 termos livres em pt-BR. Formato inline `[a, b, c]` até 5 tags; lista expandida (uma por linha) quando tiver 6+.
- **`inputs`**: lista com um item por placeholder `{{...}}` presente no corpo do prompt. Cada item tem `nome` (sem `{{}}`) e `descricao` (o que a variável representa). Se o prompt não tiver placeholders, usar `inputs: []`.

**Duplicação consciente**: o frontmatter é idêntico em `prompt.md` e `README.md`. Edições manuais precisam ser replicadas nos dois arquivos — prefira usar `/catalogar` para evitar divergência.

## Prompts que dependem de outros prompts

Dois padrões estruturais aparecem no catálogo e precisam estar declarados no `README.md` de cada prompt envolvido, porque a pasta isolada não os revela:

- **Cadeia**: a saída integral de um prompt é o parâmetro de entrada do seguinte. Cada elo é um item independente do catálogo, com sua própria pasta e seu próprio versionamento, e o `README.md` declara qual prompt o antecede e qual o sucede. O elo seguinte não refaz o trabalho do anterior: trata a saída recebida como autoridade estabelecida e, quando discorda, declara a discordância em seção própria da saída.
- **Par gerador/revisor**: um prompt produz o artefato e outro o critica sem reescrevê-lo, em ciclo de refino. O gerador aceita os apontamentos do revisor por parâmetro opcional, o que o torna o mesmo item nas duas pontas do ciclo. Recomenda-se executar o revisor em modelo diferente do gerador, ou no mínimo em sessão limpa — revisor que herda a janela de contexto de quem escreveu não questiona as restrições, opera dentro delas.

## Avaliação automatizada

Prompts cuja saída tem formato estruturado e verificável carregam um `promptfooconfig.yaml` na própria pasta, ao lado do `prompt.md`. O teste viaja junto com o prompt.

- O config referencia o prompt por caminho relativo à raiz do repositório e declara os casos de teste com os valores de cada `input` do frontmatter.
- Todo config inclui, além dos asserts de conteúdo, dois limites operacionais: latência máxima e custo máximo por chamada. Latência e custo são tratados como parte da qualidade, não como detalhe de execução.
- Prompt de saída aberta — análise, decisão, plano — não é testável por comparação de string. Esses usam avaliação por julgamento (LLM como juiz) com rubrica declarada, e o corte de aprovação fica registrado no config.
- Assert de string sobre saída em português precisa considerar normalização Unicode: rótulo com acento tem mais de uma representação byte a byte válida. Quando o formato de saída for livre, preferir rótulos sem acento; quando o formato for imposto por um padrão externo, fixar a forma normalizada no assert.

## Manutenção da documentação

Sempre que um prompt ou uma categoria for **incluído ou alterado**, revisar e atualizar:

1. **`CLAUDE.md`** — verificar se as regras, estrutura ou convenções aqui descritas continuam refletindo o estado real do repositório; ajustar seções desatualizadas.
2. **`README.md` da raiz** — índice geral do catálogo; atualizar a listagem de categorias e/ou prompts quando algo for adicionado, renomeado ou removido.
3. **`README.md` da categoria** — garantir que o escopo descrito ainda contempla os prompts existentes; atualizar quando um prompt novo ampliar ou redefinir o escopo.
4. **`README.md` do prompt** — manter objetivo, exemplo de uso e limitações alinhados ao conteúdo atual de `prompt.md`; garantir que o frontmatter esteja idêntico ao do `prompt.md`.
5. **`promptfooconfig.yaml` do prompt**, quando existir — alterar o texto do prompt sem rodar a suíte é a forma mais comum de regressão silenciosa. Se a mudança altera o formato de saída, os asserts mudam na mesma entrega; se altera os `inputs`, os casos de teste mudam junto.

A revisão da documentação faz parte da mesma entrega que a mudança do prompt — não deve ficar para depois.

## Git

- Semantic commit, mensagem de uma linha.
- Escopo do commit costuma ser a categoria (ex.: `feat(escrita): adiciona prompt de revisão de email`).
