#!/usr/bin/env node
/**
 * Aplica o corte da rubrica de `causa-raiz` sobre a saida de uma eval do promptfoo.
 *
 * Corte: total >= 6 E nenhum critério zerado.
 *
 * Existe porque esse corte NAO e expressavel na configuracao do promptfoo 0.123.1, e o
 * motivo e especifico:
 *
 *   - `threshold` de teste compara a media ponderada dos asserts. Mas 2+2+2+0 e 2+2+1+1
 *     somam 6 e tem a mesma media, e o primeiro tem que reprovar. A condicao "nenhum
 *     zerado" nao esta contida na media.
 *   - E `threshold` de teste SOBRESCREVE a reprovacao dos asserts individuais:
 *     `pass = !failedReason` e, em seguida, `if (threshold) pass = score >= threshold`.
 *     Ou seja, ligar o threshold desliga a unica mecanica que pegaria o critério zerado.
 *
 * Entao o corte fica aqui, onde as duas condicoes podem ser lidas juntas, e o codigo de
 * saida 1 serve de gate no pipeline.
 *
 * Uso:  node aplicar-corte.js <saida-da-eval.json>
 */
const fs = require('node:fs');
const path = require('node:path');

const TOTAL_MINIMO = 6;
const CRITERIOS = [
  'c1-causa-raiz',
  'c2-correlacao-vs-causa',
  'c3-acao-proporcional',
  'c4-honestidade-epistemica',
];

/** Conversao declarada em `criterios/instrucao-do-juiz.txt`: 0.0 -> 0, 0.5 -> 1, 1.0 -> 2. */
function paraPontos(score) {
  const n = Number(score);
  return {
    pontos: Math.round(n * 2),
    naEscala: [0, 0.5, 1].includes(Number(n.toFixed(4))),
  };
}

function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('uso: node aplicar-corte.js <saida-da-eval.json>');
    process.exit(2);
  }

  const dados = JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf8'));
  const resultados = dados.results?.results ?? [];
  if (resultados.length === 0) {
    console.error('nenhum resultado na saida da eval');
    process.exit(2);
  }

  const problemas = [];

  for (const r of resultados) {
    const descricao = r.testCase?.description ?? '(sem descricao)';
    const provider = r.provider?.id ?? '?';
    const componentes = r.gradingResult?.componentResults ?? [];

    console.log(`\n=== ${descricao}`);
    console.log(`    provider: ${provider}`);

    if (r.error) {
      console.log(`    ERRO NA EXECUCAO: ${String(r.error).split('\n')[0]}`);
    }

    let total = 0;
    let faltando = 0;
    const zerados = [];

    for (const metric of CRITERIOS) {
      const comp = componentes.find((c) => c.assertion?.metric === metric);
      if (!comp) {
        console.log(`    ${metric.padEnd(28)} SEM NOTA`);
        faltando++;
        continue;
      }
      const { pontos, naEscala } = paraPontos(comp.score);
      total += pontos;
      if (pontos === 0) zerados.push(metric);
      if (!naEscala) {
        problemas.push(`${metric}: score ${comp.score} fora da escala discreta 0 / 0.5 / 1`);
      }
      console.log(`    ${metric.padEnd(28)} ${pontos} ponto(s)`);
      console.log(`      ${String(comp.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 150)}`);
    }

    // Limites operacionais que nao entram na nota, mas reprovam por conta propria.
    for (const comp of componentes) {
      const tipo = comp.assertion?.type;
      if (tipo !== 'cost' && tipo !== 'latency') continue;
      console.log(`    ${tipo.padEnd(28)} ${comp.pass ? 'ok' : 'REPROVA'}  ${comp.pass ? '' : String(comp.reason ?? '').slice(0, 90)}`);
      if (!comp.pass) problemas.push(`${descricao}: limite de ${tipo} excedido`);
    }

    console.log(`    TOTAL: ${total}/8   (corte >= ${TOTAL_MINIMO} e nenhum zerado)`);

    if (faltando > 0) {
      problemas.push(`${descricao}: ${faltando} critério(s) sem nota`);
    }
    if (zerados.length > 0) {
      problemas.push(`${descricao}: critério zerado -> ${zerados.join(', ')}`);
      console.log(`    REPROVA: critério zerado (${zerados.join(', ')})`);
    } else if (total < TOTAL_MINIMO) {
      problemas.push(`${descricao}: total ${total}/8 abaixo do corte de ${TOTAL_MINIMO}`);
      console.log(`    REPROVA: total abaixo do corte`);
    } else {
      console.log('    APROVA');
    }
  }

  console.log('\n=== VEREDITO DO GATE');
  if (problemas.length === 0) {
    console.log('    APROVADO: todos os casos com total >= 6, nenhum critério zerado e');
    console.log('    limites operacionais dentro do teto.');
    process.exit(0);
  }
  console.log('    REPROVADO:');
  for (const p of problemas) console.log(`      - ${p}`);
  process.exit(1);
}

main();
