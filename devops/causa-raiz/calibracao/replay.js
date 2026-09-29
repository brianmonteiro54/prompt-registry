/**
 * Provider de replay: devolve uma saida JA REGISTRADA em vez de chamar modelo.
 *
 * Existe para separar duas fontes de variacao que, medidas juntas, nao dizem nada.
 * Rodar a rubrica contra um modelo de verdade mistura "o modelo escreveu uma analise
 * pior" com "o juiz pontuou diferente". Aqui a entrada e um arquivo fixo: se a nota
 * muda entre execucoes, a variacao e do juiz, e so dele.
 *
 * E o que permite calibrar. As duas execucoes replayadas tem nota humana registrada no
 * Checkpoint 03, entao da para medir concordancia entre juiz e humano em vez de
 * confiar que o juiz esta certo porque parece razoavel.
 */
const fs = require('node:fs');
const path = require('node:path');

module.exports = class ProviderDeReplay {
  constructor(options = {}) {
    this.providerId = options.id || 'replay';
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(_prompt, context) {
    const arquivo = context?.vars?.execucao;
    if (!arquivo) {
      return { error: 'variavel `execucao` ausente: informe o arquivo da saida registrada' };
    }

    const caminho = path.join(__dirname, arquivo);
    let texto;
    try {
      texto = fs.readFileSync(caminho, 'utf8');
    } catch (e) {
      return { error: `nao foi possivel ler ${arquivo}: ${e.message}` };
    }

    return {
      output: texto,
      // Custo e tokens zerados de proposito: nenhuma chamada de geracao acontece aqui.
      // O custo desta suite e inteiramente o do juiz, e e isso que se quer medir.
      tokenUsage: { total: 0, prompt: 0, completion: 0, numRequests: 0 },
      cost: 0,
    };
  }
};
