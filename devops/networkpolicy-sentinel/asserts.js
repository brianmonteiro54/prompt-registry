/**
 * Asserts semanticos da suite de `networkpolicy-sentinel`.
 *
 * Ficam em arquivo separado por uma razao tecnica: assert inline no YAML e avaliado
 * em contexto sem `require`, o que impede parsear o YAML da saida de verdade. Aqui
 * da para carregar um parser e verificar EFEITO da politica, e nao presenca de texto.
 *
 * A diferenca importa neste item: `contains: "5432"` passa se o numero aparecer em
 * qualquer lugar, inclusive num item que libera aquela porta para o destino errado.
 */
const yaml = require('js-yaml');

const falha = (reason) => ({ pass: false, score: 0, reason });

/**
 * Parseia a saida e NUNCA lanca.
 *
 * Assert que lanca excecao aborta a avaliacao inteira em vez de reprovar o caso: no
 * pipeline isso viraria "erro" no lugar de "falha", e erro informa menos que falha
 * porque nao diz qual requisito nao foi cumprido. Toda funcao daqui devolve motivo.
 */
function politicas(output) {
  try {
    const docs = yaml.loadAll(output).filter((d) => d && d.kind === 'NetworkPolicy');
    return { docs, erro: null };
  } catch (e) {
    return { docs: [], erro: e.message.split('\n')[0] };
  }
}

/** Parseia como YAML e exige Ingress e Egress declarados em todo objeto. */
function yamlValidoComAsDuasDirecoes(output) {
  const { docs, erro } = politicas(output);
  if (erro) return falha(`saida nao parseia como YAML: ${erro}`);
  if (docs.length === 0) return falha('nenhum documento com kind NetworkPolicy');

  const semTipos = docs.filter((d) => {
    const t = d.spec?.policyTypes || [];
    return !t.includes('Ingress') || !t.includes('Egress');
  });
  return semTipos.length === 0
    ? true
    : falha(
        `objeto(s) sem Ingress e Egress em policyTypes: ${semTipos
          .map((d) => d.metadata?.name)
          .join(', ')}`,
      );
}

/**
 * Nenhum item de regra pode ser vazio, em qualquer direcao.
 *
 * Verificacao semantica do que o assert `not-contains: "- {}"` checa por texto.
 * As duas convivem de proposito: a de texto e barata e pega a forma abreviada; esta
 * pega tambem um item vazio escrito de outra forma.
 */
function semRegraQueLiberaTudo(output) {
  const { docs, erro } = politicas(output);
  if (erro) return falha(`saida nao parseia como YAML: ${erro}`);
  const vazios = [];
  for (const d of docs) {
    for (const dir of ['ingress', 'egress']) {
      for (const [i, item] of (d.spec?.[dir] || []).entries()) {
        const ehVazio =
          item === null ||
          (typeof item === 'object' && Object.keys(item).length === 0);
        if (ehVazio) vazios.push(`${d.metadata?.name}.${dir}[${i}]`);
      }
    }
  }
  return vazios.length === 0
    ? true
    : falha(`item de regra vazio (libera qualquer origem ou destino) em: ${vazios.join(', ')}`);
}

/**
 * Cada par destino-porta esperado existe, com a porta no MESMO item do destino.
 *
 * Item com varios destinos e varias portas libera o produto cartesiano entre eles:
 * foi o defeito bloqueador encontrado na revisao da primeira versao, em que o mesmo
 * item liberava o warehouse na porta da busca e a busca na porta do warehouse.
 */
function egressPorParDestinoPorta(output) {
  const { docs, erro } = politicas(output);
  if (erro) return falha(`saida nao parseia como YAML: ${erro}`);
  const itens = docs.flatMap((d) => d.spec?.egress || []);
  const problemas = [];

  const temPar = (destino, porta) =>
    itens.some((it) => {
      const alvo = JSON.stringify(it.to || []);
      const portas = (it.ports || []).map((p) => String(p.port));
      return alvo.includes(destino) && portas.includes(String(porta));
    });

  if (!temPar('forge', 5432)) problemas.push('falta egress para forge na 5432');
  if (!temPar('cerebro', 9200)) problemas.push('falta egress para cerebro na 9200');

  const cruzados = itens.filter(
    (it) => (it.to || []).length > 1 && (it.ports || []).length > 1,
  );
  if (cruzados.length > 0) {
    problemas.push(
      `${cruzados.length} item(ns) de egress com multiplos destinos E multiplas portas, ` +
        'o que libera todos os cruzamentos entre eles',
    );
  }
  return problemas.length === 0 ? true : falha(problemas.join('; '));
}

/**
 * DNS interno precisa dos dois protocolos na porta 53.
 *
 * Liberar so um produz falha intermitente: o caminho normal continua funcionando e a
 * falha aparece apenas em parte das consultas, o que a torna caro de diagnosticar.
 */
function dnsComOsDoisProtocolos(output) {
  const { docs, erro } = politicas(output);
  if (erro) return falha(`saida nao parseia como YAML: ${erro}`);
  const dns = docs
    .flatMap((d) => d.spec?.egress || [])
    .find((it) => JSON.stringify(it.to || []).includes('kube-dns'));

  if (!dns) return falha('nenhuma regra de egress para o DNS interno');

  const protos = new Set(
    (dns.ports || []).filter((p) => String(p.port) === '53').map((p) => p.protocol),
  );
  return protos.has('UDP') && protos.has('TCP')
    ? true
    : falha(`DNS na 53 sem os dois protocolos: encontrado ${[...protos].join(', ') || 'nenhum'}`);
}

/** Todo item de regra tem comentario na linha imediatamente acima. */
function todaRegraComentada(output) {
  const linhas = output.split('\n');
  const sem = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!/^\s*-\s+(from|to):/.test(linhas[i])) continue;
    let j = i - 1;
    while (j >= 0 && linhas[j].trim() === '') j--;
    if (j < 0 || !linhas[j].trim().startsWith('#')) sem.push(i + 1);
  }
  return sem.length === 0
    ? true
    : falha(`item de regra sem comentario na linha acima: linha(s) ${sem.join(', ')}`);
}

/** A saida e YAML puro: sem cerca de bloco de codigo e sem prosa antes. */
function saidaEhYamlPuro(output) {
  const t = output.trimStart();
  if (t.startsWith('```')) {
    return falha('saida veio dentro de cerca de bloco de codigo; o prompt exige YAML puro');
  }
  return /^(#|apiVersion:|---)/.test(t)
    ? true
    : falha(`saida nao comeca em YAML: "${t.slice(0, 50)}"`);
}

module.exports = {
  yamlValidoComAsDuasDirecoes,
  semRegraQueLiberaTudo,
  egressPorParDestinoPorta,
  dnsComOsDoisProtocolos,
  todaRegraComentada,
  saidaEhYamlPuro,
};
