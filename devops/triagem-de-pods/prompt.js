// Delega para o carregador compartilhado, passando o diretorio deste prompt.
// A logica (descartar frontmatter, substituir placeholders) vive em
// `scripts/carregar-prompt.js`, e o motivo esta documentado la.
const { criarCarregador } = require('../../scripts/carregar-prompt.js');

module.exports = criarCarregador(__dirname);
