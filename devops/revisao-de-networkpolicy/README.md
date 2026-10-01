---
nome: Revisão de NetworkPolicy
descricao: Revisa uma networkpolicy contra um padrão de compliance e um mapa de serviços, devolvendo veredito, perguntas de verificação derivadas do padrão e apontamentos numerados com severidade
versao: 1.0.1
tags: [kubernetes, networkpolicy, seguranca, revisao]
inputs:
  - nome: politica
    descricao: O manifesto de NetworkPolicy a ser revisado, colado integralmente.
  - nome: regras_do_padrao
    descricao: As mesmas regras de compliance internas usadas na geração, contra as quais o cumprimento é verificado.
  - nome: mapa_de_servicos
    descricao: O mesmo mapa de namespace, labels e portas. Única fonte autorizada para julgar se um seletor é válido.
---

# Revisão de NetworkPolicy

## Objetivo

Par do prompt de endurecimento: aponta sem corrigir. Deriva as perguntas de verificação das regras do padrão em vez de aplicar lista pronta, cobre quatro categorias obrigatórias, testa a política pelo avesso perguntando qual tráfego indevido cada regra libera, e classifica cada apontamento por severidade com veredito amarrado a ela.

## Quando usar

- Uma NetworkPolicy gerada precisa passar por revisão antes de ir ao cluster.
- O ciclo de refino precisa de apontamentos numerados para o gerador responder um por um.
- É preciso saber se a política libera mais do que os fluxos declarados.

## Exemplo de uso

Na execução registrada, a revisão da primeira versão encontrou um apontamento bloqueador:

```
1. BLOQUEADOR - Onde: sentinel-allow, egress, item 1, campos to e ports. Problema: o item
   reune dois destinos e duas portas, e um item de regra libera todas as combinacoes entre
   seus criterios; o efeito e permitir tambem forge-prod/app=forge na porta 9200 e
   cerebro-prod/app=cerebro na porta 5432. Afeta: a regra do padrao que limita a saida.
```

O veredito é função declarada dos apontamentos: BARRADO se houver bloqueador, APROVADO COM RESSALVAS se houver apenas importante ou menor, APROVADO se não houver nenhum.

## Limitações conhecidas

- É sem estado: não recebe as recusas de rodadas anteriores, então reapresenta apontamento já discutido com número novo. Quem mede convergência do ciclo é a pessoa que o orquestra.
- Pendência conhecida (v1.0.1): não recebe o manifesto de origem, o que torna a categoria de cobertura de escopo estruturalmente incompleta — ele não detecta que o gerador estreitou o escopo se o estreitamento for coerente com o padrão. A correção é um parâmetro opcional para o manifesto original.
- Rodar o revisor no mesmo modelo e na mesma sessão do gerador reduz o valor da separação. Na execução registrada isso produziu um apontamento falso positivo sobre forma de seletor. Recomendado rodar em modelo diferente ou em sessão limpa.

## Histórico de versões

- **1.0.1** — correção de uma frase truncada na regra de severidade da seção 6, que dizia "não promova apontamento de forma a bloqueador" e ficou sem sentido por faltar o nível de origem. Passou a ler "de MENOR ou IMPORTANTE a BLOQUEADOR". É regra operacional e não prosa: ela é o que impede o revisor de inflar severidade para parecer rigoroso, e o Checkpoint 06 credita a ela a convergência do veredito. Nenhuma outra alteração no prompt.
- **1.0.0** — versão executada e registrada no Checkpoint 06.
