#!/usr/bin/env node
/**
 * Verifica a sanidade de cada `promptfooconfig.yaml` sem chamar modelo.
 *
 * Checa o que da para checar de graca e que, se estiver errado, custa uma execucao paga
 * para descobrir:
 *   - o YAML parseia;
 *   - os campos estruturais existem (`prompts`, `providers`, `tests`);
 *   - todo `file://` referenciado existe de fato no disco;
 *   - ha pelo menos um assert por caso ou no `defaultTest`;
 *   - os asserts em JavaScript tem sintaxe valida.
 *
 * O ultimo item nasceu de erro real: o Checkpoint 08 registrou asserts que estouravam em
 * tempo de execucao (retorno de string em vez de objeto, `require` indisponivel no
 * contexto inline), e um deles abortava a avaliacao inteira em vez de reprovar o caso.
 * Sintaxe quebrada da para pegar sem gastar nada.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');

const RAIZ = path.resolve(__dirname, '..');
const problemas = [];
let configs = 0;
let assertsJs = 0;

function refsDeArquivo(valor, acumulador) {
  if (typeof valor === 'string') {
    if (valor.startsWith('file://')) acumulador.push(valor.slice(7));
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v) => refsDeArquivo(v, acumulador));
    return;
  }
  if (valor && typeof valor === 'object') {
    Object.values(valor).forEach((v) => refsDeArquivo(v, acumulador));
  }
}

function verificarAsserts(lista, rotulo) {
  for (const a of lista || []) {
    if (a.type !== 'javascript') continue;
    if (typeof a.value !== 'string' || a.value.startsWith('file://')) continue;
    assertsJs++;
    try {
      // Os asserts inline do promptfoo sao corpo de funcao com `output` no escopo.
      new vm.Script(`(function(output, context){ ${a.value} })`);
    } catch (e) {
      problemas.push(`${rotulo}: assert javascript com sintaxe invalida - ${e.message.split('\n')[0]}`);
    }
  }
}

for (const categoria of fs.readdirSync(RAIZ)) {
  const dirCat = path.join(RAIZ, categoria);
  if (!fs.statSync(dirCat).isDirectory()) continue;
  if (['node_modules', 'scripts', '.git', '.github', '.claude'].includes(categoria)) continue;

  for (const nome of fs.readdirSync(dirCat).sort()) {
    const dir = path.join(dirCat, nome);
    if (!fs.statSync(dir).isDirectory()) continue;

    for (const arquivo of ['promptfooconfig.yaml', path.join('calibracao', 'promptfooconfig.yaml')]) {
      const cfg = path.join(dir, arquivo);
      if (!fs.existsSync(cfg)) continue;

      const rotulo = path.relative(RAIZ, cfg);
      configs++;
      let d;
      try {
        d = yaml.load(fs.readFileSync(cfg, 'utf8'));
      } catch (e) {
        problemas.push(`${rotulo}: YAML invalido - ${e.message.split('\n')[0]}`);
        continue;
      }

      for (const campo of ['prompts', 'providers', 'tests']) {
        if (!d || !d[campo]) problemas.push(`${rotulo}: falta o campo "${campo}"`);
      }
      if (!d) continue;

      // Todo file:// tem que existir, e o caminho e relativo ao diretorio do config.
      const refs = [];
      refsDeArquivo(d, refs);
      for (const ref of refs) {
        const limpo = ref.split(':')[0];
        if (!fs.existsSync(path.resolve(path.dirname(cfg), limpo))) {
          problemas.push(`${rotulo}: referencia file:// inexistente - ${limpo}`);
        }
      }

      // Todo caso precisa ter assert em algum lugar.
      const temDefault = (d.defaultTest?.assert || []).length > 0;
      for (const [i, t] of (d.tests || []).entries()) {
        const proprios = (t.assert || []).length;
        if (!temDefault && proprios === 0) {
          problemas.push(`${rotulo}: caso ${i + 1} ("${t.description || 'sem descricao'}") sem assert algum`);
        }
        verificarAsserts(t.assert, `${rotulo} caso ${i + 1}`);
      }
      verificarAsserts(d.defaultTest?.assert, `${rotulo} defaultTest`);

      console.log(`    ${rotulo.padEnd(52)} providers=${(d.providers || []).length} casos=${(d.tests || []).length} ok`);
    }
  }
}

console.log(`\n=== CONFIGS DE AVALIACAO\n    configs: ${configs}   asserts javascript inline: ${assertsJs}`);
if (problemas.length === 0) {
  console.log('\n=== VEREDITO\n    OK: configs validos, referencias resolvem e asserts compilam.');
  process.exit(0);
}
console.log('\n=== VEREDITO\n    PROBLEMAS:');
for (const p of problemas) console.log(`      - ${p}`);
process.exit(1);
