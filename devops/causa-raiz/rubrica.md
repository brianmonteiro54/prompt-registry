---
nome: Rubrica de avaliação — Análise de Causa-Raiz
aplica_a: devops/causa-raiz/prompt.md
versao: 1.0.0
escala: 0 a 2 por critério, 4 critérios, total de 0 a 8
corte: aprovado com total >= 6 E nenhum critério igual a 0
---

# Rubrica de avaliação do prompt `causa-raiz`

A saída de `causa-raiz` é análise em prosa. Não há string a conferir: duas análises
podem usar palavras completamente diferentes e as duas estarem certas, ou usar as mesmas
palavras e uma estar errada. Por isso este item é avaliado por juiz com rubrica, e não
por asserção determinística como os itens dos Checkpoints 01, 02 e 06.

## Onde esta rubrica pode e não pode aparecer

**Regra dura, e a razão de ela existir está registrada no Checkpoint 03:** o texto desta
rubrica nomeia a cadeia causal do incidente de referência. Se ele entrar no `prompt.md`,
o prompt passa a conter a resposta, e o item deixa de analisar para passar a recitar —
ficando inútil para qualquer outro pacote de artefatos.

- **Proibido** no `prompt.md`, em qualquer forma, inclusive parafraseada.
- **Obrigatório** aqui e na configuração do juiz, que é onde a verdade de referência
  pertence: o juiz precisa saber a resposta para conseguir avaliar.

Essa separação é o que permite que o mesmo prompt seja avaliado com rigor sem ser
contaminado por ele.

## Escala

Cada critério vale 0, 1 ou 2. Não há meio ponto, e a ausência de meio ponto é
deliberada: escala fina em julgamento qualitativo produz discordância entre avaliadores
sem produzir informação, porque ninguém distingue 1,4 de 1,6 de forma reprodutível.

| Nota | Significado |
|:---:|---|
| **2** | Cumpre o critério integralmente. |
| **1** | Cumpre em parte, com falha identificável que não invalida a análise. |
| **0** | Não cumpre, ou cumpre de forma que induz o plantão a erro. |

**Corte: aprovado com total >= 6 e nenhum critério igual a 0.**

A segunda condição não é redundante. Sem ela, uma análise 2+2+2+0 somaria 6 e passaria —
e um zero em qualquer destes quatro critérios significa que a análise está errada em algo
que importa. Zero em honestidade epistêmica, por exemplo, é análise que apresenta
suposição como evidência, e isso é pior que análise incompleta: leva alguém a agir com
confiança indevida.

---

## Critério 1 — Causa-raiz correta

Mede se a análise chega à causa e não para no sintoma, e se a cadeia causal respeita a
ordem dos acontecimentos.

| Nota | Condição |
|:---:|---|
| **2** | Identifica o job de reindexação que não terminou como origem, e a cadeia vai de job estagnado a heap esgotado a circuit breaker a cache expulso a busca lenta. Faz a aritmética temporal: compara o término esperado pela config com o horário observado e quantifica o atraso. |
| **1** | Chega ao recurso saturado correto (memória da JVM) mas não amarra ao job estagnado como origem, ou inverte um elo da cadeia, ou não faz a aritmética temporal. |
| **0** | Aponta a lentidão de busca, o pico de indexação ou o circuit breaker como causa. Todos são elos posteriores: tratá-los como origem leva a agir no lugar errado. |

## Critério 2 — Correlação × causa

Mede se a análise distingue o que saturou do que degradou por consequência. É o critério
que separa investigação de descrição.

| Nota | Condição |
|:---:|---|
| **2** | As três condições: (a) classifica a queda do cache de busca como EFEITO e não como causa; (b) apresenta hipótese concorrente e a descarta com evidência dos artefatos — **qualquer argumento tecnicamente correto serve**, seja apontar que o gargalo está na fila de escrita e não na de busca, seja mostrar por precedência temporal que a busca degrada depois da saturação de memória; (c) cada sinal recebe papel coerente com a sua posição no tempo. |
| **1** | Classifica a maioria dos sinais corretamente mas erra o papel de um deles, ou descarta a hipótese concorrente sem apoiar o descarte em evidência dos artefatos. |
| **0** | Trata a queda do cache ou a lentidão de busca como causa, ou lista sinais sem atribuir papel, ou não apresenta hipótese concorrente alguma. |

> A condição (b) exigia, numa versão anterior, **um** argumento específico — o da fila de
> escrita. O gate reprovou uma análise que descartou a hipótese por precedência temporal,
> que é raciocínio igualmente válido, e a rubrica foi corrigida: era sobreajuste aos dois
> exemplos de calibração. Registrado no Checkpoint 09.

## Critério 3 — Ação proporcional

Mede se a ação proposta ataca a causa encontrada, e se o risco declarado corresponde ao
risco real de executá-la em produção.

O enunciado define este critério como "propõe uma ação coerente com o diagnóstico (ex.:
conter ou reagendar a reindexação, rever heap/limites), sem sobre nem subdimensionar".
Os três exemplos citados são aceitáveis, inclusive rever heap e limites — o que reprova
não é mexer em capacidade, é mexer **só** em capacidade e deixar o job intacto, porque aí
o incidente reincide no próximo agendamento.

| Nota | Condição |
|:---:|---|
| **2** | A ação é coerente com o diagnóstico e corretamente dimensionada. A contenção age sobre o job estagnado (cancelar, interromper ou reagendar), e não sobre o sintoma. A correção de fundo nomeia o parâmetro da config que muda — limite de duração do job, agendamento, isolamento, e pode incluir revisão de heap ou de limites junto disso. O risco de cada ação identifica quem é afetado, ou declara que a classificação é provisória por falta do mapa de dependências. |
| **1** | Age sobre a causa mas a correção de fundo é genérica e não ancorada em parâmetro da config, ou o risco declarado ignora o efeito colateral da própria ação. |
| **0** | A ação é incoerente com o diagnóstico ou mal dimensionada: mexe apenas em capacidade (aumentar heap, adicionar nó) ou apenas reinicia o serviço, sem tocar no job que é a origem. Alivia o sintoma e o incidente reincide no próximo agendamento. |

## Critério 4 — Honestidade epistêmica

Mede se a análise distingue o que os artefatos provam do que ela supôs, e se declara os
limites do próprio recorte de dados.

| Nota | Condição |
|:---:|---|
| **2** | Não qualifica comportamento como natural, normal, esperado, de rotina ou sazonal sem baseline presente nos artefatos; quando não há baseline, marca a leitura como hipótese. O nível de confiança declarado tem motivo compatível com os dados. Traz três ou mais lacunas, e uma delas é a limitação de escopo dos próprios artefatos: quantas instâncias estão visíveis, que janela foi coberta, quais métricas faltam. |
| **1** | Declara lacunas mas apresenta ao menos uma suposição como fato, ou omite a limitação de escopo, ou declara confiança alta sem que os dados sustentem. |
| **0** | Não traz seção de lacunas, ou inventa valor, métrica ou parâmetro que não está nos artefatos. Fabricar evidência zera o critério independentemente do resto. |

---

## Referência humana calibrada

As duas execuções registradas no Checkpoint 03 foram pontuadas manualmente antes de
existir juiz automatizado. Elas são o par de calibração: o juiz precisa reproduzir estas
notas dentro de 1 ponto por critério **e precisa distinguir as duas nos critérios 3 e 4**.

A fonte única destas notas é
[`calibracao/referencia-humana.json`](./calibracao/referencia-humana.json). Esta tabela é
cópia para leitura.

| Critério | Execução 1 | Execução 2 |
|---|:---:|:---:|
| 1 — Causa-raiz correta | 2 | 2 |
| 2 — Correlação × causa | 2 | 2 |
| 3 — Ação proporcional | **1** | **2** |
| 4 — Honestidade epistêmica | **1** | **2** |
| **Total** | **6/8** | **8/8** |

As duas continuam aprovadas pelo corte. A execução 1 perde ponto em dois critérios:

- **Critério 4:** afirma "aumento natural da taxa de indexação" e "tráfego natural
  diurno" como fato, sem baseline nos artefatos, e traz uma única lacuna, sem registrar
  que existe log de apenas um nó.
- **Critério 3:** declara o risco da correção de fundo como "Baixo — Altera apenas
  configuração de cronograma/comportamento preventivo", sem nomear quem é afetado e sem
  declarar a classificação como provisória. Timeout sistemático deixa o índice defasado,
  que é justamente o efeito que a execução 2 nomeia.

> **Correção registrada.** O Checkpoint 03 pontuou o critério 3 da execução 1 com 2. A
> nota foi corrigida para 1 durante a calibração, e a correção é do avaliador humano, não
> do juiz: o nível 2 exige que o risco de cada ação identifique o afetado ou se declare
> provisório, e o texto não faz nenhum dos dois. O juiz apontou isso antes de eu apontar.

**Um juiz que dê a mesma nota às duas execuções nos critérios 3 e 4 não está calibrado,
está sendo generoso.** É esse o teste que o harness de calibração aplica, e ele reprovou
dois dos três candidatos.
