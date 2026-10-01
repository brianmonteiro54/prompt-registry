#!/usr/bin/env node
/**
 * Verificacoes de estrutura do catalogo, SEM chamar modelo nenhum.
 *
 * Existe para separar dois tipos de falha que o pipeline trata de forma diferente:
 * erro de estrutura (frontmatter divergente, placeholder sem `inputs`, prompt sem suite)
 * e erro de qualidade (o modelo respondeu pior). O primeiro e deterministico, custa zero
 * e nao depende de chave de API — entao roda em TODO pull request, inclusive os que vem
 * de fork, onde os segredos do repositorio nao estao disponiveis.
 *
 * Sem isso, um PR de fork nao receberia verificacao nenhuma, e os erros mais comuns de
 * manutencao de catalogo (esquecer de atualizar o `inputs`, renomear placeholder,
 * adicionar prompt sem teste) sao exatamente os que este arquivo pega.
 *
 * Uso:  node scripts/verificar-estrutura.js
 * Sai com 1 se houver qualquer problema.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const CATEGORIAS = ['devops', 'desenvolvimento', 'criacao-conteudo', 'financas', 'produtividade'];
const OBRIGATORIOS_FRONTMATTER = ['nome', 'descricao', 'versao', 'tags', 'inputs'];

const problemas = [];
const avisos = [];

function lerFrontmatter(arquivo) {
  const txt = fs.readFileSync(arquivo, 'utf8');
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { fm: null, bruto: null, corpo: txt };
  return { fm: m[1], bruto: m[0], corpo: txt.slice(m[0].length) };
}

/** Extrai os nomes de `inputs:` sem depender de parser de YAML. */
function nomesDeInputs(fm) {
  const nomes = [];
  let dentro = false;
  for (const linha of fm.split('\n')) {
    if (/^inputs\s*:/.test(linha)) {
      dentro = true;
      continue;
    }
    if (dentro && /^\S/.test(linha)) break;
    const m = linha.match(/^\s*-\s*nome\s*:\s*(\S+)/);
    if (dentro && m) nomes.push(m[1]);
  }
  return nomes;
}

function campoDoFrontmatter(fm, campo) {
  const m = fm.match(new RegExp(`^${campo}\\s*:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

let totalPrompts = 0;
let comSuite = 0;

for (const categoria of CATEGORIAS) {
  const dirCat = path.join(RAIZ, categoria);
  if (!fs.existsSync(dirCat)) continue;

  for (const nome of fs.readdirSync(dirCat).sort()) {
    const dir = path.join(dirCat, nome);
    if (!fs.statSync(dir).isDirectory()) continue;

    const promptMd = path.join(dir, 'prompt.md');
    const readmeMd = path.join(dir, 'README.md');
    const rotulo = `${categoria}/${nome}`;

    if (!fs.existsSync(promptMd)) {
      problemas.push(`${rotulo}: falta prompt.md`);
      continue;
    }
    totalPrompts++;

    if (!fs.existsSync(readmeMd)) {
      problemas.push(`${rotulo}: falta README.md`);
      continue;
    }

    const p = lerFrontmatter(promptMd);
    const r = lerFrontmatter(readmeMd);

    if (!p.fm) {
      problemas.push(`${rotulo}: prompt.md sem frontmatter`);
      continue;
    }
    if (!r.fm) {
      problemas.push(`${rotulo}: README.md sem frontmatter`);
      continue;
    }

    // 1. O template exige frontmatter IDENTICO nos dois arquivos.
    if (p.fm.trim() !== r.fm.trim()) {
      problemas.push(`${rotulo}: frontmatter de prompt.md e README.md divergem`);
    }

    // 2. Campos obrigatorios.
    for (const campo of OBRIGATORIOS_FRONTMATTER) {
      if (!new RegExp(`^${campo}\\s*:`, 'm').test(p.fm)) {
        problemas.push(`${rotulo}: frontmatter sem o campo obrigatorio "${campo}"`);
      }
    }

    // 3. versao em semver.
    const versao = campoDoFrontmatter(p.fm, 'versao');
    if (versao && !/^\d+\.\d+\.\d+$/.test(versao)) {
      problemas.push(`${rotulo}: versao "${versao}" nao esta em semver`);
    }

    // 4. Placeholders do corpo e `inputs` do frontmatter sao a MESMA coisa.
    // Esta e a verificacao que mais pega na pratica: alguem renomeia um placeholder e
    // esquece o frontmatter, e o catalogo passa a documentar parametro que nao existe.
    const placeholders = [...new Set([...p.corpo.matchAll(/\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g)].map((m) => m[1]))];
    const inputs = nomesDeInputs(p.fm);
    const semDoc = placeholders.filter((x) => !inputs.includes(x));
    const semUso = inputs.filter((x) => !placeholders.includes(x));
    if (semDoc.length > 0) {
      problemas.push(`${rotulo}: placeholder usado e nao declarado em inputs: ${semDoc.join(', ')}`);
    }
    if (semUso.length > 0) {
      problemas.push(`${rotulo}: input declarado e nao usado no corpo: ${semUso.join(', ')}`);
    }

    // 5. O corpo do prompt e autocontido (regra do CLAUDE.md): nao referencia o README.
    if (/README\.md/i.test(p.corpo)) {
      problemas.push(`${rotulo}: o corpo do prompt referencia README.md, e ele precisa ser autocontido`);
    }

    // 6. Cobertura de teste.
    const config = path.join(dir, 'promptfooconfig.yaml');
    if (fs.existsSync(config)) {
      comSuite++;
      // O carregador compartilhado precisa existir e o prompt.js precisa delegar.
      const promptJs = path.join(dir, 'prompt.js');
      if (!fs.existsSync(promptJs)) {
        problemas.push(`${rotulo}: tem promptfooconfig.yaml mas nao tem prompt.js`);
      }
    } else {
      problemas.push(`${rotulo}: prompt sem promptfooconfig.yaml (cobertura incompleta)`);
    }
  }
}

// 7. Nenhum segredo versionado.
const PADROES_SEGREDO = [/sk-[A-Za-z0-9_-]{20,}/, /AIza[A-Za-z0-9_-]{30,}/, /AQ\.[A-Za-z0-9_-]{20,}/];
function varrer(dir) {
  for (const nome of fs.readdirSync(dir)) {
    if (['node_modules', '.git', '.promptfoo'].includes(nome)) continue;
    const alvo = path.join(dir, nome);
    const st = fs.statSync(alvo);
    if (st.isDirectory()) {
      varrer(alvo);
      continue;
    }
    if (!/\.(md|ya?ml|js|json|txt)$/.test(nome)) continue;
    if (nome === 'package-lock.json') continue;
    const txt = fs.readFileSync(alvo, 'utf8');
    for (const re of PADROES_SEGREDO) {
      if (re.test(txt)) {
        problemas.push(`${path.relative(RAIZ, alvo)}: parece conter chave de API versionada`);
        break;
      }
    }
  }
}
varrer(RAIZ);

// ---------------------------------------------------------------------------
console.log(`\n=== ESTRUTURA DO CATALOGO`);
console.log(`    prompts encontrados: ${totalPrompts}`);
console.log(`    com suite de teste:  ${comSuite}`);
if (avisos.length > 0) {
  console.log('\n=== AVISOS');
  for (const a of avisos) console.log(`    - ${a}`);
}
if (problemas.length === 0) {
  console.log('\n=== VEREDITO\n    OK: estrutura, frontmatter, parametros e cobertura consistentes.');
  process.exit(0);
}
console.log('\n=== VEREDITO\n    PROBLEMAS:');
for (const p of problemas) console.log(`      - ${p}`);
process.exit(1);
