#!/usr/bin/env node
/**
 * Orquestrador das suites de avaliacao do playbook.
 *
 * Decide QUAIS suites rodar, roda, aplica o gate de cada uma e agrega o resultado num
 * resumo para o pull request. Sai com codigo 1 se qualquer gate reprovar.
 *
 * Uso:
 *   node scripts/rodar-suites.js --todas
 *   node scripts/rodar-suites.js --alterados "devops/causa-raiz/prompt.md,scripts/x.js"
 *   node scripts/rodar-suites.js --todas --resumo /tmp/resumo.md
 *
 * ---------------------------------------------------------------------------------
 * DECISAO 1 — escopo: suite inteira ou so o que mudou?
 *
 * Escolhido: so o que mudou, COM escalonamento para a suite inteira quando o arquivo
 * alterado e compartilhado.
 *
 * O que se ganha: um PR que mexe em um prompt paga uma suite (cerca de 25s e US$0,01 a
 * US$0,02) em vez da matriz inteira (cerca de 4min e US$0,35). Em repositorio de prompt
 * a maioria dos PRs toca um item.
 *
 * O que se perde, e por que o escalonamento existe: prompt nao e tao isolado quanto
 * parece. Tres acoplamentos reais neste repositorio:
 *   - `scripts/carregar-prompt.js` e lido pelos 9 prompts. Era copia em cada pasta ate o
 *     Checkpoint 10 consolidar; um bug ali quebra tudo e nao aparece em "so o que mudou".
 *   - `devops/causa-raiz/criterios/` e lido pelo gate E pelo harness de calibracao.
 *   - os elos da cadeia do Checkpoint 05 recebem a saida registrada do elo anterior, em
 *     `casos/`. Mudar a saida de um elo muda a entrada do proximo.
 * Por isso qualquer mexida em `scripts/`, `package.json` ou `casos/` dispara tudo.
 *
 * Alternativa rejeitada 1 — rodar sempre a suite inteira. Mais segura e previsivel, e
 * custa cerca de 20x mais por PR. Num repositorio onde a maioria dos PRs toca um prompt,
 * isso vira custo recorrente sem informacao nova, e o efeito colateral conhecido e o time
 * desligar o gate quando a fatura chega.
 *
 * Alternativa rejeitada 2 — so o que mudou, sem escalonamento. Mais barata ainda e
 * genuinamente insegura aqui: a consolidacao do carregador neste mesmo checkpoint toca um
 * arquivo e afeta nove suites. Um PR assim passaria sem teste nenhum.
 *
 * ---------------------------------------------------------------------------------
 * DECISAO 2 — reprovacao por flutuacao.
 *
 * Escolhido: uma repeticao automatica quando o gate reprova; reprova de verdade so se as
 * duas falharem.
 *
 * Medido no Checkpoint 09: o JUIZ e deterministico (3 repeticoes contra entradas fixas,
 * notas identicas nos 4 critérios), e o GERADOR nao (totais 6, 7, 6, 6 contra corte 6).
 * Ou seja, a flutuacao que ameaca o build nao vem do julgamento, vem da geracao — e o
 * baseline fica a um ponto do corte.
 *
 * O que se ganha: elimina a reprovacao de amostra unica pagando repeticao apenas quando
 * algo falha, que e a minoria dos casos.
 * O que se perde: um defeito que aparece em metade das geracoes passa com probabilidade
 * de 1 em 4 em vez de 1 em 2. A sensibilidade cai, e esse e o preco.
 *
 * Alternativa rejeitada 1 — tres geracoes e mediana, sempre. Elimina melhor a flutuacao e
 * triplica o custo de TODA execucao, inclusive das que iam passar de primeira.
 * Alternativa rejeitada 2 — baixar o corte do juiz de 6 para 5 no CI. Resolve a
 * flutuacao e abre mao da sensibilidade de forma permanente: 5 de 8 e analise com dois
 * critérios parciais, e deixar isso entrar derrota o proposito do gate.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_SAIDA = process.env.PROMPTFOO_OUT_DIR || '/tmp/avaliacao-playbook';

/** Caminhos que, ao mudar, forcam a suite inteira. Ver DECISAO 1. */
const COMPARTILHADOS = [/^scripts\//, /^package(-lock)?\.json$/, /^\.github\//, /casos\//, /criterios\//];

/** Suites que precisam de um script de corte depois da eval (o gate nao cabe no YAML). */
const CORTE_EXTRA = {
  'causa-raiz': 'devops/causa-raiz/aplicar-corte.js',
};

function suitesDisponiveis() {
  const encontradas = [];
  for (const categoria of fs.readdirSync(RAIZ)) {
    const dirCat = path.join(RAIZ, categoria);
    if (!fs.statSync(dirCat).isDirectory() || categoria.startsWith('.') || categoria === 'node_modules' || categoria === 'scripts') continue;
    for (const nome of fs.readdirSync(dirCat)) {
      const cfg = path.join(dirCat, nome, 'promptfooconfig.yaml');
      if (fs.existsSync(cfg)) {
        encontradas.push({ nome, categoria, config: path.relative(RAIZ, cfg) });
      }
    }
  }
  return encontradas.sort((a, b) => a.nome.localeCompare(b.nome));
}

function decidirEscopo(todas, alterados) {
  if (!alterados) return { suites: todas, motivo: 'escopo completo pedido na linha de comando' };

  const arquivos = alterados.split(',').map((s) => s.trim()).filter(Boolean);
  const gatilho = arquivos.find((a) => COMPARTILHADOS.some((re) => re.test(a)));
  if (gatilho) {
    return { suites: todas, motivo: `arquivo compartilhado alterado (${gatilho}): escalonado para a suite inteira` };
  }

  const alvo = todas.filter((s) => arquivos.some((a) => a.startsWith(`${s.categoria}/${s.nome}/`)));
  return {
    suites: alvo,
    motivo: alvo.length > 0
      ? `${alvo.length} prompt(s) alterado(s) em ${arquivos.length} arquivo(s)`
      : 'nenhum prompt alterado',
  };
}

function rodar(comando, args) {
  try {
    const saida = execFileSync(comando, args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, saida };
  } catch (e) {
    return { ok: false, saida: `${e.stdout || ''}\n${e.stderr || ''}` };
  }
}

function executarSuite(suite, tentativa) {
  const json = path.join(DIR_SAIDA, `${suite.nome}-t${tentativa}.json`);
  const eval_ = rodar('npx', ['promptfoo', 'eval', '-c', suite.config, '--no-cache', '-o', json]);

  // O gate de `causa-raiz` nao cabe na configuracao do promptfoo: o corte e
  // "total >= 6 E nenhum critério zerado", e `threshold` de teste sobrescreve a
  // reprovacao dos asserts individuais. Detalhe no Checkpoint 09.
  const extra = CORTE_EXTRA[suite.nome];
  if (extra && fs.existsSync(path.join(RAIZ, extra))) {
    if (!fs.existsSync(json)) {
      return { ok: false, detalhe: 'a eval nao produziu saida JSON', json };
    }
    const corte = rodar('node', [extra, json]);
    return { ok: corte.ok, detalhe: corte.saida.trim().split('\n').slice(-6).join('\n'), json };
  }

  const resumo = (eval_.saida.match(/\d+ (passed|failed|errors)[^\n]*/g) || []).join(' | ');
  return { ok: eval_.ok, detalhe: resumo || eval_.saida.trim().split('\n').slice(-4).join('\n'), json };
}

function main() {
  const args = process.argv.slice(2);
  const todasFlag = args.includes('--todas');
  const iAlt = args.indexOf('--alterados');
  const alterados = iAlt >= 0 ? args[iAlt + 1] : null;
  const iRes = args.indexOf('--resumo');
  const arquivoResumo = iRes >= 0 ? args[iRes + 1] : null;

  if (!todasFlag && !alterados) {
    console.error('uso: node scripts/rodar-suites.js (--todas | --alterados "a,b,c") [--resumo arquivo.md]');
    process.exit(2);
  }

  fs.mkdirSync(DIR_SAIDA, { recursive: true });
  const todas = suitesDisponiveis();
  const { suites, motivo } = todasFlag ? { suites: todas, motivo: 'escopo completo' } : decidirEscopo(todas, alterados);

  console.log(`\n=== ESCOPO: ${motivo}`);
  console.log(`    ${suites.length} de ${todas.length} suite(s): ${suites.map((s) => s.nome).join(', ') || '(nenhuma)'}`);

  if (suites.length === 0) {
    console.log('\n=== VEREDITO\n    nada a avaliar.');
    if (arquivoResumo) fs.writeFileSync(arquivoResumo, '## Avaliacao do playbook\n\nNenhum prompt alterado neste PR.\n');
    process.exit(0);
  }

  // --- 1a passada: roda cada suite uma vez ---
  for (const suite of suites) {
    process.stdout.write(`\n--- ${suite.nome} ... `);
    const r = executarSuite(suite, 1);
    console.log(r.ok ? 'asserts ok' : 'com falha(s)');
  }

  // --- gate: comparacao com o baseline ---
  // O veredito NAO e "todos os asserts passaram". E "nenhum caso que passava passou a
  // falhar". O porque esta em `scripts/baseline.js`, DECISAO 3.
  const relatorio = path.join(DIR_SAIDA, 'comparacao.json');
  let cmp = rodar('node', ['scripts/baseline.js', '--comparar', DIR_SAIDA, '--relatorio', relatorio]);
  console.log(cmp.saida.trimEnd());

  let rel = fs.existsSync(relatorio) ? JSON.parse(fs.readFileSync(relatorio, 'utf8')) : null;
  let repetidas = [];

  // GATE FECHA QUANDO NAO CONSEGUE AVALIAR.
  //
  // Esta verificacao existe por causa de uma falha real deste arquivo. A primeira versao
  // calculava `reprova = Boolean(rel && rel.reprova)`, de modo que relatorio ausente
  // virava "nao reprova". A primeira execucao no GitHub Actions rodou sem os segredos
  // configurados, as 9 suites falharam em 2 segundos cada, nenhum JSON foi produzido, a
  // comparacao nao gerou relatorio — e o job PASSOU.
  //
  // Gate que passa quando a avaliacao nao roda e pior que gate nenhum: ele produz um
  // sinal verde que ninguem vai conferir. Falta de chave, cota estourada, modelo
  // descontinuado e erro de sintaxe num assert sao todos "nao consegui avaliar", e
  // "nao consegui avaliar" nunca e "esta tudo bem".
  if (!rel) {
    console.log('\n=== VEREDITO DO GATE');
    console.log('    REPROVADO: a comparacao com o baseline nao produziu relatorio.');
    console.log('    Isso indica falha de infraestrutura e nao ausencia de regressao.');
    console.log('    Causas tipicas: chave de API ausente ou invalida, cota do provedor');
    console.log('    estourada, modelo descontinuado, erro de sintaxe em assert.');
    if (cmp.saida.trim()) console.log(`\n    saida da comparacao:\n${cmp.saida.trimEnd()}`);
    if (arquivoResumo) {
      fs.writeFileSync(
        arquivoResumo,
        [
          '## Avaliacao do playbook',
          '',
          '### Gate reprovado: a avaliacao nao conseguiu rodar',
          '',
          'A comparacao com o baseline nao produziu relatorio, o que indica falha de',
          'infraestrutura e nao ausencia de regressao. Verifique chave de API, cota do',
          'provedor e disponibilidade do modelo.',
          '',
          '```',
          cmp.saida.trim().slice(0, 1500),
          '```',
        ].join('\n'),
      );
    }
    process.exit(1);
  }

  // Suite selecionada que nao produziu caso algum tambem e falha de infraestrutura.
  const comResultado = new Set([...(rel.regressoes || []), ...(rel.melhorias || []), ...(rel.novos || [])].map((c) => c.suite));
  if (rel.executados === 0) {
    console.log('\n=== VEREDITO DO GATE\n    REPROVADO: nenhum caso foi executado.');
    process.exit(1);
  }
  void comResultado;

  // --- DECISAO 2: repete apenas as suites com regressao ---
  if (rel && rel.reprova) {
    const afetadas = new Set([
      ...rel.regressoes.map((r) => r.suite),
      ...rel.novos.filter((n) => !n.passa).map((n) => n.suite),
    ]);
    repetidas = [...afetadas];
    console.log(`\n=== REPETINDO ${afetadas.size} suite(s) com regressao: ${repetidas.join(', ')}`);
    console.log('    (a geracao nao e deterministica; o juiz da rubrica e. Ver Checkpoint 09.)');
    for (const nome of afetadas) {
      const suite = suites.find((s) => s.nome === nome);
      if (!suite) continue;
      process.stdout.write(`--- ${nome} (2a tentativa) ... `);
      const r = executarSuite(suite, 2);
      console.log(r.ok ? 'asserts ok' : 'com falha(s)');
    }
    cmp = rodar('node', ['scripts/baseline.js', '--comparar', DIR_SAIDA, '--relatorio', relatorio]);
    console.log(`\n=== REAVALIANDO APOS A REPETICAO${cmp.saida.trimEnd()}`);
    rel = fs.existsSync(relatorio) ? JSON.parse(fs.readFileSync(relatorio, 'utf8')) : rel;
  }

  const reprova = Boolean(rel && rel.reprova);

  if (arquivoResumo) {
    const md = ['## Avaliacao do playbook', '', `**Escopo:** ${motivo}`, ''];
    if (rel) {
      md.push(
        reprova
          ? '### Gate reprovado: houve regressao em relacao ao baseline'
          : '### Gate aprovado: nenhuma regressao em relacao ao baseline',
        '',
        `Casos executados: **${rel.executados}** · consistentes com o baseline: **${rel.mantidos}**`,
        '',
      );
      if (repetidas.length > 0) {
        md.push(`Suites repetidas automaticamente: ${repetidas.map((s) => `\`${s}\``).join(', ')}`, '');
      }
      if (rel.regressoes.length > 0) {
        md.push('#### Regressoes', '', '| Suite | Provider | Caso | Motivo |', '|---|---|---|---|');
        for (const r of rel.regressoes) {
          md.push(`| \`${r.suite}\` | \`${r.provider}\` | ${r.caso} | ${(r.motivo || '').replace(/\|/g, '\\|').slice(0, 180)} |`);
        }
        md.push('');
      }
      const novosFalhando = rel.novos.filter((n) => !n.passa);
      if (novosFalhando.length > 0) {
        md.push('#### Casos novos que falham', '', '| Suite | Provider | Caso | Motivo |', '|---|---|---|---|');
        for (const n of novosFalhando) {
          md.push(`| \`${n.suite}\` | \`${n.provider}\` | ${n.caso} | ${(n.motivo || '').replace(/\|/g, '\\|').slice(0, 180)} |`);
        }
        md.push('', 'Caso novo precisa estar no baseline. Corrija, ou registre com `node scripts/baseline.js --gravar`.', '');
      }
      if (rel.melhorias.length > 0) {
        md.push('#### Melhorias (nao reprovam)', '');
        for (const m of rel.melhorias) md.push(`- \`${m.suite}\` / \`${m.provider}\` / ${m.caso}`);
        md.push('', 'Regrave o baseline para travar o ganho.', '');
      }
    } else {
      md.push('A comparacao com o baseline nao produziu relatorio. Ver o log do job.', '');
    }
    md.push(
      '> O gate reprova REGRESSAO, e nao imperfeicao: falha conhecida fica registrada em',
      '> `avaliacao/baseline.json` e aceita-la exige commit. Justificativa da decisao em',
      '> `scripts/baseline.js`.',
    );
    fs.writeFileSync(arquivoResumo, md.join('\n'));
    console.log(`\n    resumo escrito em ${arquivoResumo}`);
  }

  process.exit(reprova ? 1 : 0);
}

main();
