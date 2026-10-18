---
title: "DitherLab Pro"
slug: ditherlab
date: 2026-07-20
description: "Estúdio de dithering no navegador: transforme qualquer imagem em pontilhado Floyd-Steinberg, com paletas retrô e ajustes em tempo real."
cover:
  src: /media/ditherlab/cover.png
  alt: "Círculo roxo formado por pontos em padrão de dithering ordenado sobre fundo preto"
status: beta
stack: [HTML, Canvas 2D, JavaScript]
demo: ""
repo: https://github.com/duark/labs
embed: true
draft: false
---

O **DitherLab Pro** nasceu da vontade de recriar a estética das primeiras telas monocromáticas e dos videogames portáteis sem sair do navegador. Carregue uma imagem na ferramenta acima e brinque com os controles.

## O que ele faz

- Aplica **dithering Floyd-Steinberg**, que espalha o erro de quantização de cada pixel para os vizinhos e cria a ilusão de tons intermediários usando poucas cores.
- Ajusta **resolução (tamanho do pixel), brilho e contraste** antes do processamento.
- Oferece **paletas retrô**: 1-bit preto e branco, GameBoy, sépia e CGA.
- Tem opção de **varredura serpenteada**, que alterna a direção a cada linha e reduz os padrões repetitivos.
- Exporta o resultado em **PNG**, pronto para virar textura, pôster ou frame de animação.

## Como foi feito

Tudo roda em um único arquivo HTML, sem dependências: a imagem é desenhada em um `<canvas>`, os pixels são lidos com `getImageData` e o algoritmo percorre a matriz linha a linha, distribuindo o erro com os pesos clássicos de 7/16, 3/16, 5/16 e 1/16.

```js
const err = oldPixel - newPixel;
distributeError(data, x + 1, y,     w, h, err, 7 / 16); // direita
distributeError(data, x - 1, y + 1, w, h, err, 3 / 16); // abaixo, à esquerda
distributeError(data, x,     y + 1, w, h, err, 5 / 16); // abaixo
distributeError(data, x + 1, y + 1, w, h, err, 1 / 16); // abaixo, à direita
```

## Próximos passos

- Novos algoritmos: Atkinson e Bayer ordenado, para comparar texturas lado a lado.
- Paletas personalizadas a partir de uma imagem de referência.
- Exportação em sequência de frames, para usar o efeito em vídeo.
