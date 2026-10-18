# Portfólio — Graphic, Motion & Labs

Site pessoal estático feito com **HTML, CSS e JavaScript puros** (ES Modules), gerado a partir de arquivos **Markdown** e publicado na **Vercel**.

Para publicar algo novo: crie um `.md` na pasta certa, faça commit e push. Só isso.

---

## Sumário

1. [Estrutura](#estrutura)
2. [Rodando localmente](#rodando-localmente)
3. [Criando conteúdo](#criando-conteúdo)
   - [Blog](#blog) · [Projetos](#projetos) · [Portfólio](#portfólio) · [Labs](#labs)
4. [Imagens e vídeos](#imagens-e-vídeos)
5. [Adicionando uma ferramenta interativa em Labs](#adicionando-uma-ferramenta-interativa-em-labs)
6. [Formulário de contato (Resend)](#formulário-de-contato-resend)
7. [Deploy pelo GitHub na Vercel](#deploy-pelo-github-na-vercel)
8. [Personalização](#personalização)
9. [Bibliotecas usadas e por quê](#bibliotecas-usadas-e-por-quê)

---

## Estrutura

```
/
├── api/
│   └── contact.js            # Função serverless: valida e envia o formulário via Resend
├── content/                  # TODO o conteúdo do site, em Markdown
│   ├── blog/
│   ├── projetos/
│   ├── portfolio/
│   └── labs/
├── public/                   # Copiado como está para o site
│   ├── favicon.svg
│   ├── media/<slug>/         # Imagens e vídeos, uma pasta por item
│   └── labs/<slug>/          # Ferramentas interativas autocontidas (publicadas em /tools/<slug>/)
├── src/
│   ├── site.config.js        # Nome, textos, redes sociais, e-mail, introduções das seções
│   ├── templates/            # base, home, list, item, contact, 404 + partials (head, header, footer)
│   ├── css/main.css
│   └── js/                   # main.js (global), hero.js (canvas do hero), contact.js (formulário)
├── scripts/
│   ├── build.js              # Gera /dist: páginas, índices, sitemap.xml, rss.xml, robots.txt
│   └── dev.js                # Servidor local com rebuild e recarga automática
├── package.json
├── vercel.json
└── README.md
```

O build gera:

| URL                | Arquivo gerado              |
| ------------------ | --------------------------- |
| `/`                | `dist/index.html`           |
| `/blog`            | `dist/blog/index.html`      |
| `/blog/meu-post`   | `dist/blog/meu-post.html`   |
| `/contato`         | `dist/contato.html`         |
| 404                | `dist/404.html`             |
| `/tools/<slug>/`   | cópia de `public/labs/<slug>/` |
| `/sitemap.xml`, `/rss.xml`, `/robots.txt` | gerados |

> Os arquivos antigos na raiz do repositório (`dither1.html`, `jogo1/`, `subwayB1/` etc.) **não** entram no site: só o que está em `content/`, `public/` e `src/` é publicado. O DitherLab já foi copiado para `public/labs/ditherlab/` como exemplo. Mova as outras ferramentas para `public/labs/<slug>/` quando quiser publicá-las.

---

## Rodando localmente

Requisitos: **Node.js 20.12 ou superior**.

```bash
npm install
npm run dev      # http://localhost:3000, reconstrói ao salvar e recarrega o navegador
npm run build    # gera a versão final em /dist
```

O `npm run dev` observa `content/`, `src/`, `public/` e `api/`. Salvou um `.md`, o site é reconstruído e a página recarrega sozinha. Ele também executa `/api/contact` localmente: sem um `.env`, as mensagens do formulário só aparecem no terminal; com um `.env` (veja `.env.example`), o e-mail é enviado de verdade.

Se o build encontrar um erro no conteúdo (data inválida, `alt` faltando, slug duplicado...), ele mostra o arquivo e o motivo. Na Vercel, o deploy falha com a mesma mensagem, então nada quebrado chega ao ar.

---

## Criando conteúdo

1. Crie um arquivo `.md` na pasta da seção (`content/blog/`, `content/projetos/`, `content/portfolio/` ou `content/labs/`).
2. Copie o front-matter da seção abaixo e preencha.
3. Coloque as imagens em `public/media/<slug>/`.
4. `git add . && git commit -m "Novo post" && git push`.

Regras que valem para todas as seções:

- **`draft: true`** não é publicado. Bom para rascunhos.
- A ordem é sempre por **`date`** (mais recente primeiro). Use o formato `AAAA-MM-DD`.
- **`slug`** define a URL. Se você omitir, o nome do arquivo é usado. Acentos e espaços viram hífens.
- **`tags`** geram os filtros da listagem automaticamente.
- **`featured: true`** (Projetos e Portfólio) coloca o item em destaque na home. A home mostra 3 itens por seção: primeiro os destacados, depois os mais recentes.
- Arquivos que começam com `_` (ex.: `_rascunho.md`) são ignorados.
- O corpo é Markdown comum: títulos, listas, citações, tabelas, links e blocos de código com realce de sintaxe (indique a linguagem: ` ```js `).

### Blog

`content/blog/meu-post.md`

```yaml
---
title: "Título do artigo"
slug: meu-post
date: 2026-10-18
description: "Resumo de uma ou duas frases. Aparece nos cards, no Google e nas redes."
cover:
  src: /media/meu-post/cover.jpg
  alt: "Descrição do que aparece na imagem"
tags: [motion design, processo]
draft: false
---

Texto do artigo em Markdown...
```

O tempo de leitura é calculado automaticamente. Os posts do blog também entram no `rss.xml`.

### Projetos

`content/projetos/meu-projeto.md`

```yaml
---
title: "Nome do projeto"
slug: meu-projeto
date: 2026-10-18
description: "O que é o projeto, em uma frase."
cover:
  src: /media/meu-projeto/cover.jpg
  alt: "Descrição da imagem"
tags: [tipografia, generativo]
tools: [p5.js, Figma]
featured: false
draft: false
---

Conte o projeto aqui...
```

### Portfólio

`content/portfolio/meu-case.md`

```yaml
---
title: "Nome do case"
slug: meu-case
date: 2026-10-18
client: "Nome do cliente"
role: "Direção de arte e motion design"
description: "Resumo do case."
cover:
  src: /media/meu-case/cover.jpg
  alt: "Descrição da imagem de capa"
video: /media/meu-case/reel.mp4
gallery:
  - src: /media/meu-case/frame-01.jpg
    alt: "Descrição do frame"
    caption: "Legenda opcional."
  - src: /media/meu-case/making-of.mp4
    alt: "Descrição do vídeo"
    poster: /media/meu-case/making-of.jpg
tools: [After Effects, Cinema 4D]
tags: [motion design, identidade visual]
featured: true
draft: false
---

Desafio, conceito, execução, resultado...
```

- **`video`** aceita um `.mp4`/`.webm` local (em `public/media/...`) **ou** um link do YouTube/Vimeo. Ele substitui a capa no topo da página.
- Com vídeo **local**, o card da listagem toca um preview ao passar o mouse.
- **`gallery`** aceita imagens e vídeos misturados e aparece em grid depois do texto.
- O case de exemplo usa um vídeo público do Vimeo só para demonstrar o embed. Troque pelo seu.

### Labs

`content/labs/minha-ferramenta.md`

```yaml
---
title: "Nome da ferramenta"
slug: minha-ferramenta
date: 2026-10-18
description: "O que a ferramenta faz."
cover:
  src: /media/minha-ferramenta/cover.png
  alt: "Descrição da imagem"
status: beta            # beta | estável | arquivado
stack: [JavaScript, Canvas 2D, OpenAI API]
demo: ""                # URL externa opcional (botão "Abrir em nova aba")
repo: https://github.com/usuario/repo
embed: true             # carrega public/labs/<slug>/index.html dentro da página
draft: false
---

Como funciona, o que aprendi...
```

---

## Imagens e vídeos

- Guarde a mídia em `public/media/<slug>/` e referencie com caminho absoluto: `/media/<slug>/arquivo.jpg`.
- **`alt` é obrigatório** em `cover` e em cada item de `gallery`. Sem ele, o build falha e diz onde está o problema.
- **Largura e altura são lidas automaticamente** do arquivo e declaradas no HTML (sem saltos de layout). Para imagens externas, informe `width` e `height` manualmente.
- Imagens em `loading="lazy"`; a capa da página de item carrega com prioridade.
- Vídeos são `muted playsinline loop` e só baixam quando chegam perto da tela.
- Imagens dentro do texto: `![descrição](/media/slug/img.jpg "legenda opcional")`. Um `.mp4` nessa sintaxe vira um player de vídeo.
- Para redes sociais (Open Graph), use capas em **JPG, PNG ou WebP** com proporção 1.91:1 ou 16:9 (ex.: 1200×630). SVG não é aceito pelas redes. Sem capa compatível, o site usa `public/media/og-default.png`.
- Mídia é cacheada pelo navegador por 7 dias. Ao substituir uma imagem, prefira um **novo nome de arquivo**.

---

## Adicionando uma ferramenta interativa em Labs

1. Crie a pasta `public/labs/<slug>/` com um `index.html` autocontido. Ela pode ter seus próprios CSS, JS, fontes e modelos em subpastas, sempre com **caminhos relativos** (`src/main.js`, `assets/fonte.otf`).
2. Crie `content/labs/<slug>.md` com o **mesmo slug** e `embed: true`.
3. Commit e push.

A ferramenta é publicada em `/tools/<slug>/` e aparece num iframe na página `/labs/<slug>`, com um botão para abrir em nova aba. O build injeta uma tag `<base href="/tools/<slug>/">` no `index.html` da ferramenta (se ela ainda não tiver uma) para os caminhos relativos funcionarem com ou sem barra no fim da URL.

Dicas:
- A ferramenta deve funcionar em larguras pequenas: o iframe ocupa a largura da página e tem ~82% da altura da tela.
- Se a ferramenta usa uma chave de API de IA, **não** coloque a chave no código do navegador. Crie uma função em `/api/` (como `api/contact.js`) que faça a chamada usando uma variável de ambiente.
- Se `embed: true` e a pasta não existir, o build falha com um aviso claro.
- Para uma ferramenta hospedada em outro lugar, use `embed: false` e preencha `demo` com a URL.

---

## Formulário de contato (Resend)

A página `/contato` envia para `/api/contact`, que:
- valida nome (2–100 caracteres), e-mail e mensagem (10–5000 caracteres);
- descarta bots com um campo **honeypot** invisível (`website`);
- envia o e-mail pelo **Resend** com `reply-to` apontando para quem escreveu;
- funciona também sem JavaScript (redireciona para `/contato?status=ok`).

### Variáveis de ambiente

| Variável         | Obrigatória | Exemplo                                  |
| ---------------- | ----------- | ---------------------------------------- |
| `RESEND_API_KEY` | sim         | `re_123...`                              |
| `CONTACT_TO`     | sim         | `voce@seudominio.com` (aceita vários, separados por vírgula) |
| `CONTACT_FROM`   | não         | `Portfólio <contato@seudominio.com>`     |
| `SITE_URL`       | não         | `https://seudominio.com`                 |

1. Crie uma conta em [resend.com](https://resend.com) e gere uma API key em **API Keys**.
2. Para enviar de um endereço seu, verifique o domínio em **Domains** e use-o em `CONTACT_FROM`. Sem domínio verificado, o remetente padrão `onboarding@resend.dev` só consegue enviar para o e-mail da sua própria conta Resend, o que já basta para receber as mensagens do formulário.
3. Na Vercel: **Project → Settings → Environment Variables**, adicione as variáveis para *Production* (e *Preview*, se quiser testar nos previews) e faça um novo deploy.

Localmente, copie `.env.example` para `.env` e preencha. O `.env` está no `.gitignore` e nunca vai para o GitHub.

---

## Deploy pelo GitHub na Vercel

1. Envie o repositório para o GitHub (`git push`).
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. Não precisa mudar nada: o `vercel.json` já define `buildCommand: npm run build`, `outputDirectory: dist`, URLs limpas e cache de mídia. Em *Framework Preset*, deixe **Other**.
4. Adicione as variáveis de ambiente do formulário (seção acima).
5. Clique em **Deploy**.

A partir daí, **cada push na branch principal publica o site**, e cada push em outra branch ou PR gera uma URL de preview.

A URL usada em sitemap, RSS, links canônicos e Open Graph vem de `siteUrl` em `src/site.config.js` (hoje `https://www.duark.com.br`). A variável de ambiente `SITE_URL`, se existir, tem prioridade. Sem nenhuma das duas, o build usa o domínio de produção detectado pela Vercel.

### Domínio (www.duark.com.br)

O `index.html` **não fica na raiz do repositório**: o build gera `dist/index.html` e a Vercel publica a pasta `dist`. Para o domínio funcionar com e sem `www`:

1. Vercel → Project → **Settings → Domains**: adicione `www.duark.com.br` e `duark.com.br`, e configure o `duark.com.br` para **redirecionar** para `www.duark.com.br`.
2. No painel DNS do seu domínio:
   - `A` · `@` → o IP que a Vercel mostrar na tela de Domains (ex.: `216.198.79.1`)
   - `CNAME` · `www` → o valor que a Vercel mostrar (ex.: `cname.vercel-dns.com`)
3. Aguarde a propagação (de minutos a algumas horas). A Vercel emite o HTTPS sozinha.

---

## Personalização

- **Nome, textos do hero, e-mail, redes e introduções das seções:** `src/site.config.js`.
- **Cores, tipografia, espaçamentos:** variáveis no topo de `src/css/main.css`. O roxo `--accent` é usado em destaques, foco e estados ativos; `--accent-text` é uma versão mais clara usada só em texto pequeno sobre superfícies, para manter contraste AA.
- **Estrutura das páginas:** `src/templates/`. `{{chave}}` insere um valor e `{{> nome}}` inclui um partial de `src/templates/partials/`.
- **Animação do hero:** `src/js/hero.js` (densidade, cores, raio do cursor no topo do arquivo). A animação pausa fora da tela e com a aba oculta, e vira um quadro estático com `prefers-reduced-motion`.
- **Imagem padrão de compartilhamento:** `public/media/og-default.png`.
- **Google Analytics:** `googleAnalyticsId` em `src/site.config.js`. A tag gtag.js entra no `<head>` de todas as páginas no build de produção e fica de fora no `npm run dev`, para seus testes locais não contarem como visita. Deixe `''` para desativar. As ferramentas em `/tools/<slug>/` não recebem a tag, mas as visitas às páginas `/labs/<slug>` que as exibem são contadas.

---

## Bibliotecas usadas e por quê

Todas rodam **só no build**. O navegador recebe apenas HTML, CSS e ~18 KB de JavaScript próprio, sem minificar (o do hero e o do formulário só carregam nas páginas que os usam).

| Biblioteca         | Por quê |
| ------------------ | ------- |
| `gray-matter`      | Lê o front-matter YAML dos `.md` de forma confiável (datas, listas, objetos aninhados como `cover` e `gallery`). |
| `marked`           | Converte Markdown em HTML, rápido e com suporte a GFM (tabelas, listas de tarefas). Permite personalizar imagens, links e títulos (lazy loading, `target="_blank"` em links externos, âncoras nos títulos). |
| `marked-highlight` + `highlight.js` | Realce de sintaxe dos blocos de código **gerado no build**: zero JavaScript extra no navegador. As cores estão no próprio `main.css`, combinando com o tema. |
| `image-size`       | Lê largura e altura das imagens para declarar no HTML automaticamente. Evita saltos de layout (CLS) sem você precisar anotar dimensões. |

Ficaram de fora de propósito:
- **GSAP:** as animações do site (entrada do hero, revelação no scroll, hover) são simples o bastante para CSS + IntersectionObserver, e o fundo do hero é Canvas 2D puro. Adicionar GSAP custaria ~70 KB sem ganho real aqui. Se um dia precisar de timelines complexas, ele entra fácil via ES Module.
- **SDK do Resend:** a função usa `fetch` direto na API REST do Resend, sem dependências.
- **Bibliotecas de servidor/watch:** o `dev.js` usa só módulos nativos do Node (`http`, `fs.watch`).

Sobre `npm audit`: o aviso atual vem de uma dependência antiga do `js-yaml` usada pelo `gray-matter`. Ele só roda no build, sobre arquivos seus, então não afeta a segurança do site publicado.
