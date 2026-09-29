#!/usr/bin/env node
/**
 * Compara a pontuacao do juiz com a referencia humana e decide se o juiz esta calibrado.
 *
 * Existe porque a verificacao que interessa cruza casos de teste, e um assert do
 * promptfoo so ve o proprio caso. As duas execucoes replayadas sao o mesmo pacote de
 * artefatos com o prompt em dois estagios de refino: o que qualifica um juiz nao e
 * acertar uma nota isolada, e sim reproduzir a DIFERENCA entre as duas. Juiz que da a
 * mesma nota para as duas passaria em qualquer assert individual e seria inutil.
 *
 * A referencia humana vem de `referencia-humana.json`, e nao do metadata do caso de
 * teste, para que corrigir uma nota humana nao exija re-executar o juiz.
 *
 * Uso:  node calibrar.js <saida-da-eval.json>
 * Sai com codigo 1 quando a calibracao falha, para servir de gate no pipeline.
 */
const fs = require('node:fs');
const path = require('node:path');

const ref = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'referencia-humana.json'), 'utf8'),
);

/**
 * Conversao inversa da declarada no `rubricPrompt`: 0.0 -> 0, 0.5 -> 1, 1.0 -> 2.
 *
 * Sinaliza quando o juiz devolveu valor que nao corresponde a nivel algum da rubrica.
 * Isso nao e preciosismo: score 0.7 nao significa "entre 1 e 2 pontos", significa que o
 * juiz ignorou a escala, e comparar esse numero com a nota humana nao mede nada.
 */
function paraPontos(score) {
  const n = Number(score);
  return {
    pontos: Math.round(n * 2),
    naEscala: [0, 0.5, 1].includes(Number(n.toFixed(4))),
  };
}

function coletar(resultados) {
  return resultados.map((r) => {
    const descricao = r.testCase?.description ?? '(sem descricao)';
    const execRef = ref.execucoes.find((e) =>
      descricao.toLowerCase().includes(e.casa_com_descricao.toLowerCase()),
    );
    const componentes = r.gradingResult?.componentResults ?? [];
    const juiz = {};
    const motivos = {};
    const foraDaEscala = [];

    for (const c of ref.criterios) {
      const comp = componentes.find((x) => x.assertion?.metric === c.metric);
      if (!comp) continue;
      const { pontos, naEscala } = paraPontos(comp.score);
      juiz[c.metric] = pontos;
      motivos[c.metric] = String(comp.reason ?? '').replace(/\s+/g, ' ').trim();
      if (!naEscala) foraDaEscala.push(`${descricao} / ${c.nome}: score ${comp.score}`);
    }

    return {
      descricao,
      juiz,
      motivos,
      foraDaEscala,
      humano: execRef?.notas ?? null,
      erro: r.error ? String(r.error).split('\n')[0] : null,
    };
  });
}

function aprovaPeloCorte(notas) {
  const valores = Object.values(notas);
  if (valores.length === 0) return null;
  const total = valores.reduce((a, b) => a + b, 0);
  const temZero = valores.some((n) => n === 0);
  return total >= ref.corte.total_minimo && !(temZero && !ref.corte.permite_criterio_zero);
}

function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('uso: node calibrar.js <saida-da-eval.json>');
    process.exit(2);
  }

  const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const resultados = dados.results?.results ?? [];
  if (resultados.length === 0) {
    console.error('nenhum resultado na saida da eval');
    process.exit(2);
  }

  const casos = coletar(resultados);
  const problemas = [];
  let divergencias = 0;

  for (const caso of casos) {
    console.log(`\n=== ${caso.descricao}`);
    if (caso.erro) console.log(`    ERRO NA EXECUCAO: ${caso.erro}`);
    if (!caso.humano) {
      console.log('    sem referencia humana para este caso');
      problemas.push(`caso sem referencia humana: "${caso.descricao}"`);
      continue;
    }

    for (const c of ref.criterios) {
      const j = caso.juiz[c.metric];
      const h = caso.humano[c.metric];
      if (j === undefined || h === undefined) {
        console.log(`    ${c.nome.padEnd(28)} sem dado`);
        continue;
      }
      const delta = Math.abs(j - h);
      if (delta > 1) divergencias++;
      const marca = delta === 0 ? 'igual' : delta === 1 ? 'dentro de 1' : 'FORA DE 1';
      console.log(`    ${c.nome.padEnd(28)} juiz ${j}  humano ${h}  -> ${marca}`);
      console.log(`      motivo: ${caso.motivos[c.metric].slice(0, 170)}`);
    }

    const totalJuiz = Object.values(caso.juiz).reduce((a, b) => a + b, 0);
    const totalHumano = Object.values(caso.humano).reduce((a, b) => a + b, 0);
    const cJuiz = aprovaPeloCorte(caso.juiz);
    const cHumano = aprovaPeloCorte(caso.humano);
    console.log(`    TOTAL: juiz ${totalJuiz}/8  humano ${totalHumano}/8`);
    console.log(
      `    CORTE (>=${ref.corte.total_minimo} e nenhum zero): juiz ${cJuiz ? 'aprova' : 'reprova'}, humano ${cHumano ? 'aprova' : 'reprova'}`,
    );
    if (cJuiz !== cHumano) {
      problemas.push(`decisao de corte divergente em "${caso.descricao}"`);
    }
    caso.foraDaEscala.forEach((f) => problemas.push(`nota fora da escala discreta: ${f}`));
  }

  // ---------- testes de discriminacao ----------
  console.log('\n=== TESTES DE DISCRIMINACAO');
  for (const d of ref.discriminacao_exigida) {
    const alvo = ref.criterios.find((c) => c.metric === d.criterio);
    const maior = casos.find((c) => c.descricao.toLowerCase().includes(d.maior.toLowerCase()));
    const menor = casos.find((c) => c.descricao.toLowerCase().includes(d.menor.toLowerCase()));
    const vMaior = maior?.juiz[d.criterio];
    const vMenor = menor?.juiz[d.criterio];

    if (vMaior === undefined || vMenor === undefined) {
      console.log(`    ${alvo?.nome ?? d.criterio}: indeterminado, faltou dado`);
      problemas.push(`discriminacao indeterminada em ${d.criterio}`);
      continue;
    }
    const ok = vMaior > vMenor;
    console.log(
      `    ${(alvo?.nome ?? d.criterio).padEnd(28)} ${d.menor} = ${vMenor}, ${d.maior} = ${vMaior}  -> ${ok ? 'OK' : 'FALHA'}`,
    );
    if (!ok) {
      problemas.push(
        `juiz nao distinguiu ${d.menor} de ${d.maior} em ${alvo?.nome ?? d.criterio}`,
      );
    }
  }

  // ---------- veredito ----------
  if (divergencias > 0) {
    problemas.unshift(`${divergencias} critério(s) com divergencia maior que 1 ponto`);
  }

  console.log('\n=== VEREDITO DA CALIBRACAO');
  if (problemas.length === 0) {
    console.log('    CALIBRADO: concordancia dentro de 1 ponto em todos os critérios,');
    console.log('    discriminacoes reproduzidas e decisao de corte igual a humana.');
    process.exit(0);
  }
  console.log('    NAO CALIBRADO:');
  for (const p of problemas) console.log(`      - ${p}`);
  process.exit(1);
}

main();
