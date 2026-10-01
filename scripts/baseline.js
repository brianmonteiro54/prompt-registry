#!/usr/bin/env node
/**
 * Gate por comparacao com baseline: reprova REGRESSAO, e nao imperfeicao.
 *
 * ---------------------------------------------------------------------------------
 * DECISAO 3 — o que faz o build falhar.
 *
 * Escolhido: falha quando um caso que passava passa a falhar, comparado com
 * `avaliacao/baseline.json`, versionado no repositorio.
 *
 * O problema que isso resolve e concree medido. Com os 9 prompts cobertos e dois
 * fornecedores cada, a suite completa fica assim no estado atual do catalogo:
 *
 *   gemini-3.5-flash  reprova 2 de 9 suites
 *   gpt-4o-mini       reprova 6 de 9 suites
 *
 * E as reprovacoes sao legitimas: regra de severidade nao aplicada, cerca de bloco de
 * codigo numa saida que promete YAML colavel, risco silencioso ordenado depois do
 * visivel, fase inexistente detalhada como se existisse. Nenhuma delas e bug de assert.
 *
 * Um gate que exige verde total fica vermelho desde o primeiro dia. E limite vermelho no
 * baseline nao detecta regressao nenhuma, so ensina o time a ignorar a suite — e esse
 * diagnostico nao e teorico, e o mesmo erro que o Checkpoint 08 registrou nos limites de
 * latencia e custo de `networkpolicy-sentinel`, e que o Checkpoint 09 repetiu no limite de
 * custo do gate de `causa-raiz`.
 *
 * O enunciado define o que o pipeline precisa barrar: "quando um prompt regride (ou seja,
 * quando uma mudanca piora um prompt em relacao a versao anterior)". Regressao e
 * comparacao com o estado anterior, nao com a perfeicao. O baseline torna isso executavel.
 *
 * Propriedade importante: aceitar uma falha conhecida exige COMMIT no baseline. Ela deixa
 * de ser silenciosa e passa a ser revisavel — alguem olha o diff e pergunta por que.
 *
 * Alternativa rejeitada 1 — gate so no provider de referencia, com o segundo informativo.
 * Barato e sem falso positivo, porque o fornecedor recomendado reprova pouco. Perde o que
 * o segundo fornecedor existe para medir: divergencia entre eles e sinal de prompt fragil,
 * e descartar o sinal no gate e manter o custo do segundo provider sem o beneficio dele.
 * Perde tambem a deteccao de regressao no modelo barato, que e o que a maioria do time
 * usa no dia a dia.
 *
 * Alternativa rejeitada 2 — exigir verde total e corrigir os prompts antes de ligar o
 * gate. E o ideal, e a conta nao fecha: parte das reprovacoes e limitacao do modelo
 * barato e nao defeito corrigivel de prompt (a regra de severidade de `triagem-de-pods`
 * foi reescrita tres vezes no Checkpoint 08 e o `gpt-4o-mini` continua errando). Ou o
 * prompt vira sobreajuste ao modelo fraco, ou o gate fica desligado esperando. As duas
 * saidas sao piores que registrar a falha e barrar a piora.
 *
 * ---------------------------------------------------------------------------------
 * Uso:
 *   node scripts/baseline.js --comparar <dir-com-json>   # gate; exit 1 em regressao
 *   node scripts/baseline.js --gravar   <dir-com-json>   # regrava o baseline
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const ARQUIVO_BASELINE = path.join(RAIZ, 'avaliacao', 'baseline.json');

/** Chave estavel de um caso: suite + provider + descricao do caso. */
function chave(suite, provider, descricao) {
  return `${suite} :: ${provider} :: ${descricao}`;
}

function lerExecucao(dir) {
  const casos = new Map();
  if (!fs.existsSync(dir)) return casos;

  for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    // `<suite>-t<N>.json`; mantem a tentativa de maior numero, que e a que valeu.
    const m = arquivo.match(/^(.*)-t(\d+)\.json$/);
    if (!m) continue;
    const suite = m[1];

    let d;
    try {
      d = JSON.parse(fs.readFileSync(path.join(dir, arquivo), 'utf8'));
    } catch {
      continue;
    }
    for (const r of d.results?.results ?? []) {
      const provider = r.provider?.id ?? '?';
      const descricao = r.testCase?.description ?? '(sem descricao)';
      const k = chave(suite, provider, descricao);
      const passou = Boolean(r.success);
      // Tentativas posteriores sobrescrevem: a repeticao e que decide.
      casos.set(k, {
        suite,
        provider,
        descricao,
        passou,
        motivo: passou ? null : String(r.error ?? '').split('\n')[0].slice(0, 220),
      });
    }
  }
  return casos;
}

function gravar(dir) {
  const atual = lerExecucao(dir);
  if (atual.size === 0) {
    console.error(`nenhum resultado encontrado em ${dir}`);
    process.exit(2);
  }
  const porSuite = {};
  for (const c of [...atual.values()].sort((a, b) => chave(a.suite, a.provider, a.descricao).localeCompare(chave(b.suite, b.provider, b.descricao)))) {
    porSuite[c.suite] ??= [];
    porSuite[c.suite].push({
      provider: c.provider,
      caso: c.descricao,
      passa: c.passou,
      ...(c.passou ? {} : { motivo_conhecido: c.motivo }),
    });
  }
  const conteudo = {
    _sobre: [
      'Resultado esperado de cada caso de teste, por suite e por provider.',
      '',
      'O gate do pipeline compara a execucao contra este arquivo e reprova quando um caso',
      'que passava passa a falhar. Caso com `passa: false` e falha CONHECIDA e documentada,',
      'nao e falha aceita em silencio: mudar este arquivo exige commit, e o diff fica',
      'visivel na revisao.',
      '',
      'Regravar com:  node scripts/baseline.js --gravar <dir-com-json>',
      'Ao regravar depois de corrigir um prompt, o commit deve explicar o que mudou.',
    ],
    gravado_em: new Date().toISOString().slice(0, 10),
    casos: porSuite,
  };
  fs.mkdirSync(path.dirname(ARQUIVO_BASELINE), { recursive: true });
  fs.writeFileSync(ARQUIVO_BASELINE, `${JSON.stringify(conteudo, null, 2)}\n`);

  const passando = [...atual.values()].filter((c) => c.passou).length;
  console.log(`baseline gravado em ${path.relative(RAIZ, ARQUIVO_BASELINE)}`);
  console.log(`  ${atual.size} caso(s): ${passando} passando, ${atual.size - passando} com falha conhecida`);
}

function comparar(dir) {
  if (!fs.existsSync(ARQUIVO_BASELINE)) {
    console.error(`baseline ausente em ${path.relative(RAIZ, ARQUIVO_BASELINE)}; grave com --gravar`);
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(ARQUIVO_BASELINE, 'utf8'));
  const esperado = new Map();
  for (const [suite, lista] of Object.entries(base.casos || {})) {
    for (const c of lista) esperado.set(chave(suite, c.provider, c.caso), c.passa);
  }

  const atual = lerExecucao(dir);
  if (atual.size === 0) {
    console.error(`nenhum resultado encontrado em ${dir}`);
    process.exit(2);
  }

  const iRel = process.argv.indexOf('--relatorio');
  const arquivoRelatorio = iRel >= 0 ? process.argv[iRel + 1] : null;

  const regressoes = [];
  const melhorias = [];
  const novos = [];
  let mantidos = 0;

  for (const [k, c] of atual) {
    if (!esperado.has(k)) {
      novos.push(c);
      continue;
    }
    const antes = esperado.get(k);
    if (antes && !c.passou) regressoes.push(c);
    else if (!antes && c.passou) melhorias.push(c);
    else mantidos++;
  }

  // Caso que existia no baseline e nao foi executado nesta rodada nao e problema: o
  // escopo pode ter sido reduzido de proposito pela DECISAO 1.
  console.log('\n=== COMPARACAO COM O BASELINE');
  console.log(`    casos executados: ${atual.size}   consistentes com o baseline: ${mantidos}`);

  if (novos.length > 0) {
    console.log(`\n    CASOS NOVOS (${novos.length}) — ausentes do baseline:`);
    for (const c of novos) {
      console.log(`      ${c.passou ? 'passa' : 'FALHA'}  ${c.suite} / ${c.provider} / ${c.descricao}`);
      if (!c.passou) console.log(`             ${c.motivo}`);
    }
    console.log('      -> caso novo que falha reprova o gate: ou corrija, ou registre no baseline.');
  }

  if (melhorias.length > 0) {
    console.log(`\n    MELHORIAS (${melhorias.length}) — falhavam no baseline e agora passam:`);
    for (const c of melhorias) console.log(`      ${c.suite} / ${c.provider} / ${c.descricao}`);
    console.log('      -> nao reprova. Regrave o baseline para travar o ganho.');
  }

  if (regressoes.length > 0) {
    console.log(`\n    REGRESSOES (${regressoes.length}) — passavam no baseline e agora falham:`);
    for (const c of regressoes) {
      console.log(`      ${c.suite} / ${c.provider} / ${c.descricao}`);
      console.log(`             ${c.motivo}`);
    }
  }

  const novosFalhando = novos.filter((c) => !c.passou);
  const reprova = regressoes.length > 0 || novosFalhando.length > 0;

  // Relatorio estruturado para o orquestrador decidir o que repetir e para montar o
  // comentario do pull request.
  if (arquivoRelatorio) {
    fs.writeFileSync(
      arquivoRelatorio,
      `${JSON.stringify(
        {
          executados: atual.size,
          mantidos,
          regressoes: regressoes.map(({ suite, provider, descricao, motivo }) => ({ suite, provider, caso: descricao, motivo })),
          melhorias: melhorias.map(({ suite, provider, descricao }) => ({ suite, provider, caso: descricao })),
          novos: novos.map(({ suite, provider, descricao, passou, motivo }) => ({ suite, provider, caso: descricao, passa: passou, motivo })),
          reprova,
        },
        null,
        2,
      )}\n`,
    );
  }

  console.log('\n=== VEREDITO DO GATE');
  if (!reprova) {
    console.log('    APROVADO: nenhuma regressao em relacao ao baseline.');
    if (melhorias.length > 0) console.log(`    (${melhorias.length} melhoria(s) detectada(s); vale regravar o baseline)`);
    process.exit(0);
  }
  console.log('    REPROVADO:');
  if (regressoes.length > 0) console.log(`      - ${regressoes.length} regressao(oes)`);
  if (novosFalhando.length > 0) console.log(`      - ${novosFalhando.length} caso(s) novo(s) falhando`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dir = args[1] || process.env.PROMPTFOO_OUT_DIR || '/tmp/avaliacao-playbook';
if (args[0] === '--gravar') gravar(dir);
else if (args[0] === '--comparar') comparar(dir);
else {
  console.error('uso: node scripts/baseline.js (--comparar | --gravar) <dir-com-json>');
  process.exit(2);
}
