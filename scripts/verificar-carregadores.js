#!/usr/bin/env node
/**
 * Verifica que todo `prompt.js` carrega, descarta o frontmatter e substitui placeholders.
 *
 * Nao chama modelo. Pega a classe de erro que o Checkpoint 08 descobriu do jeito caro:
 * o promptfoo enviava o frontmatter YAML ao modelo, sujando o teste e gastando token, e
 * isso so apareceu ao ler a saida de uma execucao paga. Aqui custa zero.
 *
 * Tambem protege a consolidacao do carregador feita no Checkpoint 10: os 9 `prompt.js`
 * delegam para `scripts/carregar-prompt.js`, e um erro nesse modulo quebra os nove de uma
 * vez. Esta verificacao roda antes de qualquer chamada paga.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const problemas = [];
let verificados = 0;

(async () => {
  for (const categoria of fs.readdirSync(RAIZ)) {
    const dirCat = path.join(RAIZ, categoria);
    if (!fs.statSync(dirCat).isDirectory()) continue;
    if (['node_modules', 'scripts', '.git', '.github', '.claude'].includes(categoria)) continue;

    for (const nome of fs.readdirSync(dirCat).sort()) {
      const dir = path.join(dirCat, nome);
      if (!fs.statSync(dir).isDirectory()) continue;
      const arquivo = path.join(dir, 'prompt.js');
      if (!fs.existsSync(arquivo)) continue;

      const rotulo = `${categoria}/${nome}`;
      verificados++;
      try {
        const carregar = require(arquivo);
        if (typeof carregar !== 'function') {
          problemas.push(`${rotulo}: prompt.js nao exporta uma funcao`);
          continue;
        }
        const texto = await carregar({ vars: {} });
        if (typeof texto !== 'string' || texto.length === 0) {
          problemas.push(`${rotulo}: carregador devolveu conteudo vazio`);
          continue;
        }
        if (texto.startsWith('---')) {
          problemas.push(`${rotulo}: o frontmatter vazou para o prompt enviado ao modelo`);
        }
        const sobrando = [...new Set([...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
        if (sobrando.length > 0) {
          problemas.push(`${rotulo}: placeholder nao substituido: ${sobrando.join(', ')}`);
        }
        console.log(`    ${rotulo.padEnd(42)} ${String(texto.length).padStart(6)} chars  ok`);
      } catch (e) {
        problemas.push(`${rotulo}: erro ao carregar - ${e.message.split('\n')[0]}`);
      }
    }
  }

  console.log(`\n=== CARREGADORES\n    verificados: ${verificados}`);
  if (problemas.length === 0) {
    console.log('\n=== VEREDITO\n    OK: todos os carregadores funcionam e nao vazam frontmatter.');
    process.exit(0);
  }
  console.log('\n=== VEREDITO\n    PROBLEMAS:');
  for (const p of problemas) console.log(`      - ${p}`);
  process.exit(1);
})();
