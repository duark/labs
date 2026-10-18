---
title: "O ritmo antes da forma: notas sobre timing em motion design"
slug: o-ritmo-antes-da-forma
date: 2026-09-28
description: "Por que eu começo uma animação pela trilha e pela curva de velocidade, e só depois penso no desenho."
cover:
  src: /media/motion-design-ritmo/cover.png
  alt: "Ondas roxas sobre fundo preto, como uma forma de onda de áudio desacelerando"
tags: [motion design, processo, timing]
draft: false
---

Durante anos eu abri o After Effects pelo desenho. Primeiro a composição, depois a tipografia, e só no fim, com tudo bonito e parado, eu pensava em como aquilo ia se mexer. O resultado era sempre o mesmo: peças que funcionavam como pôster e tropeçavam como filme.

Hoje faço o contrário. **Antes de qualquer forma, decido o ritmo.**

## Começar pela trilha

Toda peça que faço começa com um arquivo de áudio, mesmo quando o vídeo final vai ser mudo. A trilha dá três coisas que nenhum moodboard dá:

1. **Andamento.** Um BPM define quanto tempo cada ideia tem para respirar.
2. **Acentos.** Os pontos onde algo *precisa* acontecer.
3. **Silêncios.** Os pontos onde nada deve acontecer, e que são tão importantes quanto os acentos.

Com a trilha marcada, eu desenho blocos cinza na timeline. Nada de design ainda: só retângulos entrando e saindo no tempo certo. Se essa versão feia já tem pulso, o resto é acabamento.

## A curva é o desenho

A curva de velocidade é onde mora a personalidade de uma animação. A mesma caixa indo de A para B pode parecer pesada, nervosa, elegante ou cômica dependendo só do *easing*.

> Linear é a ausência de intenção. Toda curva é uma opinião.

Uso três famílias quase sempre:

- **Saída rápida, chegada lenta** (`ease-out`) para elementos que entram e precisam assentar.
- **Saída lenta, chegada rápida** (`ease-in`) para elementos que saem de cena.
- **Overshoot leve** para o que precisa de energia, como logos e chamadas.

No código, a mesma lógica vale. Quando animo interfaces, escrevo as curvas como variáveis para manter o vocabulário consistente:

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in: cubic-bezier(0.64, 0, 0.78, 0);
  --ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card {
  transition: transform 480ms var(--ease-out);
}
```

## Escalonar é compor no tempo

Quando vários elementos entram juntos, o atraso entre eles (o *stagger*) faz o papel que o espaçamento faz no layout. Um atraso de 40 ms parece uma onda; 120 ms parece uma lista; 300 ms parece uma conversa.

```js
const items = document.querySelectorAll('.word');
items.forEach((el, i) => {
  el.animate(
    [{ opacity: 0, transform: 'translateY(0.6em)' }, { opacity: 1, transform: 'none' }],
    { duration: 600, delay: i * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
  );
});
```

## O teste do olho fechado

Meu último teste antes de entregar qualquer peça: assisto de olhos semicerrados. Sem conseguir ler nada, sobra só o movimento. Se ainda dá para sentir onde estão os acentos, a peça está pronta.

O desenho convence o olho. O ritmo convence o corpo.
