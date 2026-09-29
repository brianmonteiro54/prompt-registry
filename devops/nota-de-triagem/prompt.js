/**
 * Carregador do prompt para a suite de avaliacao.
 *
 * Existe por um motivo unico: `prompt.md` carrega frontmatter YAML, que e metadado
 * do catalogo e nao faz parte do prompt. Enviar o frontmatter ao modelo sujaria o
 * teste e gastaria tokens. Este arquivo le o proprio `prompt.md` do diretorio,
 * descarta o frontmatter e substitui os placeholders pelos valores do caso de teste.
 *
 * Le o arquivo real, e nao uma copia: alterar `prompt.md` muda o que a suite testa,
 * que e a condicao para o pipeline barrar regressao.
 */
const fs = require('node:fs');
const path = require('node:path');

const SEM_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

module.exports = async function ({ vars }) {
  const corpo = fs
    .readFileSync(path.join(__dirname, 'prompt.md'), 'utf8')
    .replace(SEM_FRONTMATTER, '')
    .trimStart();

  // Placeholder sem valor no caso de teste vira string vazia. Isso e intencional:
  // parametro opcional ausente precisa exercitar o caminho de fallback do prompt.
  return corpo.replace(PLACEHOLDER, (_, nome) =>
    vars[nome] === undefined || vars[nome] === null ? '' : String(vars[nome]),
  );
};
