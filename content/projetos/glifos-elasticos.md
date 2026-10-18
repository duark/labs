---
title: "Glifos Elásticos"
slug: glifos-elasticos
date: 2026-08-14
description: "Uma família tipográfica generativa em que cada letra é uma grade de pontos que reage a som e ao cursor."
cover:
  src: /media/glifos-elasticos/cover.png
  alt: "Grade de círculos roxos de tamanhos variados formando diagonais rítmicas sobre fundo preto"
tags: [tipografia, generativo, código criativo]
tools: [p5.js, Glyphs, Web Audio API]
featured: true
draft: false
---

**Glifos Elásticos** começou como uma pergunta simples: e se uma letra fosse um instrumento, e não um desenho?

Cada glifo é construído sobre uma grade de 12 × 18 pontos. O desenho da letra define apenas quais pontos estão "ligados". O tamanho de cada ponto, por sua vez, vem de fora: da amplitude do microfone, da distância até o cursor ou de um campo de ruído que muda devagar.

## Como funciona

1. Desenhei o alfabeto em uma grade baixa no Glyphs, exportando cada letra como uma matriz binária.
2. Um sketch em p5.js lê essas matrizes e desenha um círculo por ponto ativo.
3. A Web Audio API entrega a energia de três bandas de frequência (graves, médios, agudos), e cada banda controla uma faixa vertical da letra.

O efeito é uma tipografia que *pulsa* com a música: graves incham a base das letras, agudos fazem as hastes vibrarem.

## O que aprendi

- **Legibilidade tem um limite elástico.** Até cerca de 40% de variação no raio dos pontos, a palavra continua legível. Acima disso, vira textura.
- **Ruído precisa de memória.** Ruído puro parece eletricidade estática; suavizar os valores ao longo de alguns frames transforma o ruído em respiração.
- **Restrição gera estilo.** A grade baixa obrigou soluções estranhas para letras como *g* e *ç*, e essas soluções viraram a identidade da família.

## Próximos passos

Quero exportar a fonte como variable font, usando a amplitude como eixo de variação, para que ela possa ser usada fora do navegador, em peças de motion e em impressos.
