---
nome: Endurecimento de NetworkPolicy
descricao: Transforma um manifesto de networkpolicy permissivo em política endurecida contra um padrão de compliance e um mapa de identidade de serviços, devolvendo yaml puro
versao: 1.0.0
tags: [kubernetes, networkpolicy, seguranca, compliance]
inputs:
  - nome: manifesto_atual
    descricao: O manifesto de NetworkPolicy permissivo a ser endurecido, colado integralmente.
  - nome: regras_do_padrao
    descricao: Regras de compliance internas que a versão corrigida precisa cumprir, incluindo os fluxos legítimos declarados.
  - nome: mapa_de_servicos
    descricao: Namespace, labels de pod e portas de cada serviço envolvido nos fluxos. Única fonte autorizada de seletores.
  - nome: apontamentos
    descricao: Opcional. Apontamentos numerados de uma revisão anterior. Vazio produz a primeira versão; preenchido produz a versão corrigida com cada apontamento atendido ou recusado.
---

# Endurecimento de NetworkPolicy

## Objetivo

Endurece política de rede permissiva sem inventar seletor: namespace, label e porta saem exclusivamente do mapa recebido. O prompt impõe a distinção entre escopo da política e regra de permissão, que é a origem do erro mais comum na área, e obriga cada item de regra a declarar quantas combinações produz. Aceita apontamentos de revisão anterior, o que o torna o mesmo prompt nas duas pontas do ciclo de refino.

## Quando usar

- Manifesto de NetworkPolicy foi barrado em revisão de segurança por ser permissivo demais.
- É preciso derivar regras de uma lista de fluxos legítimos sem inventar label ou porta.
- O artefato vai passar por rodadas de verificação e refino antes de chegar ao cluster.

## Exemplo de uso

Recebendo um manifesto com escopo amplo e regras vazias em ambas as direções, mais o padrão e o mapa de serviços, a saída é YAML puro com dois objetos: uma política de negação por padrão e uma política de permissão com um item por par origem-destino-porta, cada um comentado com o fluxo que libera.

Toda premissa, lacuna e resposta a apontamento vai em comentário YAML, porque comentário é o único canal de texto livre desta saída. Validado com `kubeconform` em modo estrito.

## Limitações conhecidas

- Pendência conhecida (v1.0.1): a regra sobre combinações dentro de um item cobre dois eixos na mesma seção, e na execução registrada o modelo aplicou o primeiro com rigor e passou por cima do segundo, produzindo um item que liberava o produto cartesiano entre destinos e portas. A correção é separar os dois eixos em regras próprias e exigir que cada item declare as combinações que produz.
- Pendência conhecida (v1.0.1): a proibição de escrever a forma abreviada de regra vazia foi generalizada para proibir chaves em qualquer lugar da saída, o que tirou de circulação a forma documentada de seletor vazio. A correção é encolher a proibição ao padrão específico e corrigir o assert do teste para procurar a string exata.
- Não presume versão de Kubernetes nem CNI. Seleção de namespace por label depende de o namespace carregar aquele label, e o prompt declara essa pré-condição como premissa em vez de assumi-la.
- O nome da pasta carrega o caso de estreia por compatibilidade com o arquivo de teste, mas o corpo do prompt é genérico e funciona para qualquer namespace e qualquer conjunto de fluxos.
