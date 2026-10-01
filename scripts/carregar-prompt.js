/**
 * Carregador compartilhado dos prompts para as suites de avaliacao.
 *
 * Existe por um motivo unico: `prompt.md` carrega frontmatter YAML, que e metadado do
 * catalogo e nao faz parte do prompt. Enviar o frontmatter ao modelo sujaria o teste e
 * gastaria tokens. Este modulo le o `prompt.md` real do diretorio do prompt, descarta o
 * frontmatter e substitui os placeholders pelos valores do caso de teste.
 *
 * Le o arquivo real, e nao uma copia: alterar `prompt.md` muda o que a suite testa, que
 * e a condicao para o pipeline barrar regressao.
 *
 * ----------------------------------------------------------------------------------
 * Por que um modulo compartilhado, e por que ele nao existia antes.
 *
 * No Checkpoint 08 este codigo vivia duplicado em `devops/<prompt>/prompt.js`, tres
 * copias identicas, e a duplicacao foi registrada como deliberada: o promptfoo resolve
 * `file://prompt.js` relativo ao diretorio do config, de modo que `__dirname` apontava
 * para a pasta do prompt e achava o `prompt.md` certo sem configuracao nenhuma.
 *
 * Com a cobertura completa do Checkpoint 10 as copias passariam de tres para nove, e aí
 * o custo troca de lado: nove arquivos identicos divergem na primeira correcao que
 * alguem esquecer de propagar. A solucao mantem a propriedade boa e remove a copia —
 * cada prompt tem um `prompt.js` de UMA linha que delega para ca, passando o seu proprio
 * `__dirname`. O modulo nao precisa saber o caminho por configuracao e o YAML nao
 * carrega informacao que o sistema de arquivos ja tem.
 */
const fs = require('node:fs');
const path = require('node:path');

const SEM_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Devolve a funcao de carregamento que o promptfoo espera, amarrada a um diretorio.
 *
 * @param {string} diretorio Pasta do prompt, tipicamente `__dirname` de quem chama.
 */
function criarCarregador(diretorio) {
  return async function ({ vars }) {
    const corpo = fs
      .readFileSync(path.join(diretorio, 'prompt.md'), 'utf8')
      .replace(SEM_FRONTMATTER, '')
      .trimStart();

    // Placeholder sem valor no caso de teste vira string vazia. Isso e intencional:
    // parametro opcional ausente precisa exercitar o caminho de fallback do prompt.
    return corpo.replace(PLACEHOLDER, (_, nome) =>
      vars[nome] === undefined || vars[nome] === null ? '' : String(vars[nome]),
    );
  };
}

module.exports = { criarCarregador };
