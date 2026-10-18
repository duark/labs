#!/usr/bin/env node
/**
 * Gerador estático do portfólio.
 *
 * Lê os arquivos .md de /content, aplica os templates de /src/templates e grava
 * o site completo em /dist: páginas de item, índices de seção, home, contato,
 * 404, sitemap.xml, rss.xml e robots.txt. Também copia /public e /src/{css,js}.
 *
 * Uso: `npm run build` (a Vercel roda isso a cada push).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { imageSize } from 'image-size';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = {
  content: path.join(ROOT, 'content'),
  public: path.join(ROOT, 'public'),
  templates: path.join(ROOT, 'src', 'templates'),
  css: path.join(ROOT, 'src', 'css'),
  js: path.join(ROOT, 'src', 'js'),
  config: path.join(ROOT, 'src', 'site.config.js'),
  dist: path.join(ROOT, 'dist'),
};

const SECTIONS = ['blog', 'projetos', 'portfolio', 'labs'];
const LAB_STATUS = { beta: 'beta', estavel: 'estável', 'estável': 'estável', arquivado: 'arquivado' };
// As ferramentas de /public/labs/<slug> são publicadas em /tools/<slug>/ para não
// colidir com as páginas de item em /labs/<slug>.
const TOOLS_BASE = '/tools';
const WORDS_PER_MINUTE = 200;

class BuildError extends Error {}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugify = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toList = (value) =>
  (Array.isArray(value) ? value : value == null || value === '' ? [] : [value])
    .map((v) => String(v).trim())
    .filter(Boolean);

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDate = (date) => dateFormatter.format(date).replace(/\./g, '');
const isoDate = (date) => date.toISOString().slice(0, 10);

const isVideoFile = (src = '') => /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(src);
const isLocal = (src = '') => src.startsWith('/') && !src.startsWith('//');
const OG_FORMATS = /\.(png|jpe?g|webp|gif)(?:[?#].*)?$/i;

function warn(message) {
  console.warn(`  \u26a0 ${message}`);
}

function writeFile(relPath, contents) {
  const target = path.join(PATHS.dist, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/* ------------------------------------------------------------------ */
/* Mídia                                                               */
/* ------------------------------------------------------------------ */

const dimensionCache = new Map();

function localMediaPath(src) {
  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  return path.join(PATHS.public, clean);
}

/** Lê largura/altura reais de uma imagem local para declarar no HTML (evita CLS). */
function getDimensions(src, context) {
  if (!isLocal(src) || isVideoFile(src)) return null;
  if (dimensionCache.has(src)) return dimensionCache.get(src);
  const file = localMediaPath(src);
  let dims = null;
  if (!fs.existsSync(file)) {
    warn(`${context}: arquivo não encontrado em public${src}`);
  } else {
    try {
      const { width, height } = imageSize(fs.readFileSync(file));
      dims = { width, height };
    } catch {
      warn(`${context}: não foi possível ler as dimensões de ${src}`);
    }
  }
  dimensionCache.set(src, dims);
  return dims;
}

/**
 * Normaliza uma entrada de imagem/vídeo do front-matter.
 * Formato exigido: { src, alt, caption?, width?, height?, poster? }.
 */
function normalizeMedia(input, context) {
  if (input == null || input === '') return null;
  if (typeof input === 'string') {
    throw new BuildError(
      `${context}: imagens e vídeos precisam de texto alternativo. Use:\n` +
        `    src: ${input}\n    alt: "Descrição do que aparece na imagem"`
    );
  }
  const src = String(input.src || '').trim();
  const alt = String(input.alt || '').trim();
  if (!src) throw new BuildError(`${context}: campo "src" ausente.`);
  if (!alt) throw new BuildError(`${context}: campo "alt" é obrigatório (${src}).`);
  const kind = isVideoFile(src) ? 'video' : 'image';
  const dims =
    input.width && input.height
      ? { width: Number(input.width), height: Number(input.height) }
      : getDimensions(src, context);
  return {
    src,
    alt,
    kind,
    caption: input.caption ? String(input.caption) : '',
    poster: input.poster ? String(input.poster) : '',
    width: dims?.width || null,
    height: dims?.height || null,
  };
}

/** Aceita mp4/webm local, YouTube ou Vimeo. */
function parseVideo(url, context) {
  if (!url) return null;
  const src = String(url).trim();
  const yt = src.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: 'youtube', src, embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: 'vimeo', src, embed: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  if (isVideoFile(src)) {
    if (isLocal(src) && !fs.existsSync(localMediaPath(src))) warn(`${context}: vídeo não encontrado em public${src}`);
    return { type: 'file', src };
  }
  throw new BuildError(`${context}: "video" deve ser um .mp4/.webm ou um link do YouTube/Vimeo (${src}).`);
}

function imgTag(media, { className = '', eager = false, sizes = '' } = {}) {
  const attrs = [
    `src="${escapeHtml(media.src)}"`,
    `alt="${escapeHtml(media.alt)}"`,
    media.width ? `width="${media.width}" height="${media.height}"` : '',
    eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
    sizes ? `sizes="${sizes}"` : '',
    className ? `class="${className}"` : '',
  ];
  return `<img ${attrs.filter(Boolean).join(' ')}>`;
}

/** Vídeo leve: sem src até entrar na viewport (ver src/js/main.js). */
function videoTag(src, { className = '', poster = '', label = '', controls = false, autoplay = true, decorative = false } = {}) {
  const attrs = [
    className ? `class="${className}"` : '',
    `data-src="${escapeHtml(src)}"`,
    poster ? `poster="${escapeHtml(poster)}"` : '',
    'muted playsinline loop preload="none"',
    autoplay ? 'data-autoplay' : '',
    controls ? 'controls' : '',
    decorative ? 'aria-hidden="true" tabindex="-1"' : label ? `aria-label="${escapeHtml(label)}"` : '',
  ];
  return `<video ${attrs.filter(Boolean).join(' ')}></video>`;
}

function embedTag(embedUrl, title) {
  return `<div class="embed"><iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

let currentFile = '';
let headingIds = new Set();

const markdown = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
  {
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        let id = slugify(text.replace(/<[^>]+>/g, '')) || `secao-${depth}`;
        let n = 2;
        while (headingIds.has(id)) id = `${id.replace(/-\d+$/, '')}-${n++}`;
        headingIds.add(id);
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        if (!text) warn(`${currentFile}: imagem sem texto alternativo no Markdown (${href}).`);
        const media = { src: href, alt: text || '', caption: title || '' };
        let el;
        if (isVideoFile(href)) {
          el = videoTag(href, { label: media.alt, controls: true });
        } else {
          const dims = getDimensions(href, currentFile);
          el = imgTag({ ...media, ...(dims || {}) });
        }
        return media.caption
          ? `<figure>${el}<figcaption>${escapeHtml(media.caption)}</figcaption></figure>`
          : el;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${
          external ? ' target="_blank" rel="noopener noreferrer"' : ''
        }>${text}</a>`;
      },
    },
  }
);

function renderMarkdown(source, file) {
  currentFile = file;
  headingIds = new Set();
  return markdown.parse(source);
}

function readingTime(source) {
  const words = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-[\]()!]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

function loadSection(section) {
  const dir = path.join(PATHS.content, section);
  if (!fs.existsSync(dir)) return [];

  const items = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const context = `content/${section}/${file}`;
    let parsed;
    try {
      parsed = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (error) {
      throw new BuildError(`${context}: front-matter inválido. ${error.message}`);
    }
    const { data, content } = parsed;
    if (data.draft === true) continue;

    for (const field of ['title', 'date', 'description']) {
      if (!data[field]) throw new BuildError(`${context}: campo obrigatório "${field}" ausente.`);
    }
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    if (Number.isNaN(date.getTime())) {
      throw new BuildError(`${context}: data inválida "${data.date}". Use AAAA-MM-DD.`);
    }
    const slug = slugify(data.slug || path.basename(file, '.md'));
    if (!slug || slug === 'index') throw new BuildError(`${context}: slug inválido "${data.slug}".`);

    const item = {
      section,
      file: context,
      slug,
      url: `/${section}/${slug}`,
      title: String(data.title),
      description: String(data.description),
      date,
      tags: toList(data.tags),
      featured: data.featured === true,
      cover: normalizeMedia(data.cover, `${context} → cover`),
      html: renderMarkdown(content, context),
    };

    if (item.cover?.kind === 'video') {
      throw new BuildError(`${context}: "cover" deve ser uma imagem. Use o campo "video" para vídeos.`);
    }

    if (section === 'blog') {
      item.readingTime = readingTime(content);
    }
    if (section === 'projetos') {
      item.tools = toList(data.tools);
    }
    if (section === 'portfolio') {
      item.client = data.client ? String(data.client) : '';
      item.role = data.role ? String(data.role) : '';
      item.tools = toList(data.tools);
      item.video = parseVideo(data.video, `${context} → video`);
      item.gallery = (Array.isArray(data.gallery) ? data.gallery : []).map((entry, i) =>
        normalizeMedia(entry, `${context} → gallery[${i}]`)
      );
    }
    if (section === 'labs') {
      const status = LAB_STATUS[String(data.status || 'beta').toLowerCase()];
      if (!status) throw new BuildError(`${context}: status deve ser beta, estável ou arquivado.`);
      item.status = status;
      item.stack = toList(data.stack);
      item.demo = data.demo ? String(data.demo) : '';
      item.repo = data.repo ? String(data.repo) : '';
      item.embed = data.embed === true;
      if (item.embed) {
        const toolIndex = path.join(PATHS.public, 'labs', slug, 'index.html');
        if (!fs.existsSync(toolIndex)) {
          throw new BuildError(`${context}: embed: true, mas public/labs/${slug}/index.html não existe.`);
        }
        item.embedUrl = `${TOOLS_BASE}/${slug}/`;
      }
    }

    items.push(item);
  }

  items.sort((a, b) => b.date - a.date);

  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.slug)) throw new BuildError(`content/${section}: slug duplicado "${item.slug}".`);
    seen.add(item.slug);
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

function loadTemplates() {
  const read = (rel) => fs.readFileSync(path.join(PATHS.templates, rel), 'utf8');
  const partials = {};
  for (const file of fs.readdirSync(path.join(PATHS.templates, 'partials'))) {
    if (file.endsWith('.html')) partials[path.basename(file, '.html')] = read(`partials/${file}`);
  }
  return {
    partials,
    base: read('base.html'),
    home: read('home.html'),
    list: read('list.html'),
    item: read('item.html'),
    contact: read('contact.html'),
    notFound: read('404.html'),
  };
}

/**
 * Motor de template mínimo: `{{> partial}}` inclui um partial e `{{chave}}`
 * insere o valor já pronto (o build escapa o que precisa ser escapado).
 * A substituição acontece numa única passada, então conteúdo inserido nunca é reprocessado.
 */
function render(template, data, partials = {}) {
  let source = template;
  for (let depth = 0; depth < 5 && /\{\{>\s*[\w-]+\s*\}\}/.test(source); depth++) {
    source = source.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new BuildError(`Partial "${name}" não encontrado em src/templates/partials.`);
      return partials[name];
    });
  }
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => (data[key] ?? '').toString());
}

/* ------------------------------------------------------------------ */
/* Componentes                                                         */
/* ------------------------------------------------------------------ */

function tagList(tags, className = 'tags') {
  if (!tags.length) return '';
  return `<ul class="${className}" role="list">${tags
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join('')}</ul>`;
}

function statusBadge(status) {
  return `<span class="status status--${slugify(status)}">${escapeHtml(status)}</span>`;
}

function card(item, { headingLevel = 2 } = {}) {
  const h = `h${headingLevel}`;
  const preview = item.video?.type === 'file';
  const media = item.cover
    ? imgTag(item.cover, { className: 'card__img', sizes: '(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw' })
    : `<span class="card__placeholder" aria-hidden="true">${escapeHtml(item.title.charAt(0))}</span>`;
  const extra = [];
  if (item.readingTime) extra.push(`<span>${item.readingTime} min de leitura</span>`);
  if (item.client) extra.push(`<span>${escapeHtml(item.client)}</span>`);
  if (item.status) extra.push(statusBadge(item.status));

  return `<article class="card reveal"${preview ? ' data-preview' : ''} data-tags="${escapeHtml(
    item.tags.map(slugify).join(' ')
  )}">
  <a class="card__link" href="${item.url}">
    <div class="card__media">
      ${media}
      ${preview ? videoTag(item.video.src, { className: 'card__preview', autoplay: false, decorative: true }) : ''}
    </div>
    <div class="card__body">
      <p class="card__meta"><time datetime="${isoDate(item.date)}">${formatDate(item.date)}</time>${extra.join('')}</p>
      <${h} class="card__title">${escapeHtml(item.title)}</${h}>
      <p class="card__desc">${escapeHtml(item.description)}</p>
      ${tagList(item.tags)}
    </div>
  </a>
</article>`;
}

function filters(items) {
  const counts = new Map();
  for (const item of items) {
    for (const tag of item.tags) {
      const key = slugify(tag);
      const entry = counts.get(key) || { label: tag, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  }
  if (!counts.size) return '';
  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label, 'pt-BR'));
  const chip = (key, label, count, pressed) =>
    `<button type="button" class="chip" data-filter="${key}" aria-pressed="${pressed}">${escapeHtml(label)} <span class="chip__count">${count}</span></button>`;
  return `  <div class="filters" role="group" aria-label="Filtrar por tag">
    ${chip('', 'Todos', items.length, true)}
    ${sorted.map(([key, { label, count }]) => chip(key, label, count, false)).join('\n    ')}
  </div>`;
}

function metaList(item) {
  const rows = [[`Data`, `<time datetime="${isoDate(item.date)}">${formatDate(item.date)}</time>`]];
  if (item.readingTime) rows.push(['Leitura', `${item.readingTime} min`]);
  if (item.client) rows.push(['Cliente', escapeHtml(item.client)]);
  if (item.role) rows.push(['Papel', escapeHtml(item.role)]);
  if (item.status) rows.push(['Status', statusBadge(item.status)]);
  if (item.tools?.length) rows.push(['Ferramentas', escapeHtml(item.tools.join(', '))]);
  if (item.stack?.length) rows.push(['Stack', escapeHtml(item.stack.join(', '))]);
  return `    <dl class="meta">${rows
    .map(([k, v]) => `<div class="meta__row"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('')}</dl>`;
}

function itemActions(item) {
  if (item.section !== 'labs') return '';
  const links = [];
  const demo = item.demo || item.embedUrl;
  if (demo) {
    links.push(
      `<a class="button button--primary" href="${escapeHtml(demo)}" target="_blank" rel="noopener">Abrir em nova aba <span class="visually-hidden">(abre em nova aba)</span></a>`
    );
  }
  if (item.repo) {
    links.push(
      `<a class="button button--ghost" href="${escapeHtml(item.repo)}" target="_blank" rel="noopener noreferrer">Código-fonte <span class="visually-hidden">(abre em nova aba)</span></a>`
    );
  }
  return links.length ? `    <div class="item__actions">${links.join('')}</div>` : '';
}

function itemHero(item) {
  let inner = '';
  if (item.section === 'labs' && item.embed) {
    inner = `<div class="lab-embed">
      <iframe src="${item.embedUrl}" title="${escapeHtml(item.title)}: ferramenta interativa" loading="lazy" allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe>
    </div>`;
  } else if (item.video?.type === 'file') {
    inner = videoTag(item.video.src, {
      className: 'item__video',
      poster: item.cover?.src || '',
      label: item.cover?.alt || item.title,
      controls: true,
    });
  } else if (item.video) {
    inner = embedTag(item.video.embed, item.title);
  } else if (item.cover) {
    inner = imgTag(item.cover, { className: 'item__cover', eager: true, sizes: '(min-width: 1400px) 1320px, 100vw' });
  }
  return inner ? `  <div class="item__hero container container--wide">${inner}</div>` : '';
}

function gallery(item) {
  if (!item.gallery?.length) return '';
  const figures = item.gallery
    .map((media) => {
      const el =
        media.kind === 'video'
          ? videoTag(media.src, { poster: media.poster, label: media.alt })
          : imgTag(media, { sizes: '(min-width: 900px) 50vw, 100vw' });
      return `<figure class="gallery__item reveal">${el}${
        media.caption ? `<figcaption>${escapeHtml(media.caption)}</figcaption>` : ''
      }</figure>`;
    })
    .join('\n      ');
  return `  <section class="gallery container container--wide" aria-label="Galeria">
    <div class="gallery__grid">
      ${figures}
    </div>
  </section>`;
}

function pager(items, index) {
  const older = items[index + 1];
  const newer = items[index - 1];
  if (!older && !newer) return '';
  const link = (item, rel, label) =>
    `<a class="pager__link pager__link--${rel}" href="${item.url}" rel="${rel}"><span class="pager__label">${label}</span><span class="pager__title">${escapeHtml(item.title)}</span></a>`;
  return `    <nav class="pager" aria-label="Navegação entre itens">
      ${older ? link(older, 'prev', '← Anterior') : '<span></span>'}
      ${newer ? link(newer, 'next', 'Próximo →') : '<span></span>'}
    </nav>`;
}

function socialLinks(config, indent = '      ') {
  return config.social
    .map(
      (s) =>
        `${indent}<li><a class="social__link link" href="${escapeHtml(s.url)}" target="_blank" rel="me noopener noreferrer">${escapeHtml(s.label)}</a></li>`
    )
    .join('\n');
}

function homeBlock(section, items, index, config) {
  const info = config.sections[section];
  // Itens em destaque primeiro; depois completa com os mais recentes.
  const picks = [...items.filter((i) => i.featured), ...items.filter((i) => !i.featured)].slice(0, 3);
  const id = `home-${section}`;
  return `<section class="home-block container" aria-labelledby="${id}">
  <div class="home-block__head reveal">
    <p class="eyebrow">${String(index + 1).padStart(2, '0')} / ${escapeHtml(info.title)}</p>
    <h2 class="home-block__title" id="${id}">${escapeHtml(info.title)}</h2>
    <p class="home-block__intro">${escapeHtml(info.intro)}</p>
    <a class="link link--arrow" href="/${section}">Ver todos<span class="visually-hidden"> os itens de ${escapeHtml(info.title)}</span></a>
  </div>
  ${
    picks.length
      ? `<div class="grid grid--home">\n${picks.map((item) => card(item, { headingLevel: 3 })).join('\n')}\n  </div>`
      : '<p class="empty">Em breve.</p>'
  }
</section>`;
}

/* ------------------------------------------------------------------ */
/* Feeds                                                               */
/* ------------------------------------------------------------------ */

const escapeXml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cdata = (s = '') => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

/** Torna URLs relativas do HTML absolutas (para leitores de RSS). */
const absolutize = (html, siteUrl) => html.replace(/(src|href|poster)="\/(?!\/)/g, `$1="${siteUrl}/`);

function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>
`;
}

function rss(posts, config, siteUrl) {
  const lastBuild = posts[0]?.date || new Date();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(config.name)} — Blog</title>
    <link>${siteUrl}/blog</link>
    <description>${escapeXml(config.sections.blog.intro)}</description>
    <language>${config.lang.toLowerCase()}</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}${p.url}</link>
      <guid isPermaLink="true">${siteUrl}${p.url}</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${escapeXml(p.description)}</description>
${p.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join('\n')}
      <content:encoded>${cdata(absolutize(p.html, siteUrl))}</content:encoded>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>
`;
}

/* ------------------------------------------------------------------ */
/* Cópia de arquivos estáticos                                         */
/* ------------------------------------------------------------------ */

function copyPublic() {
  if (!fs.existsSync(PATHS.public)) return;
  for (const entry of fs.readdirSync(PATHS.public)) {
    if (entry === 'labs') continue;
    fs.cpSync(path.join(PATHS.public, entry), path.join(PATHS.dist, entry), { recursive: true });
  }

  const labsDir = path.join(PATHS.public, 'labs');
  if (!fs.existsSync(labsDir)) return;
  for (const slug of fs.readdirSync(labsDir)) {
    const src = path.join(labsDir, slug);
    if (!fs.statSync(src).isDirectory()) continue;
    const dest = path.join(PATHS.dist, TOOLS_BASE.slice(1), slug);
    fs.cpSync(src, dest, { recursive: true });
    // Garante que caminhos relativos da ferramenta (css, js, imagens) funcionem
    // com ou sem barra final na URL.
    const index = path.join(dest, 'index.html');
    if (fs.existsSync(index)) {
      const html = fs.readFileSync(index, 'utf8');
      if (!/<base\s/i.test(html)) {
        const baseTag = `<base href="${TOOLS_BASE}/${slug}/">`;
        const patched = /<head[^>]*>/i.test(html)
          ? html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${baseTag}`)
          : `${baseTag}\n${html}`;
        fs.writeFileSync(index, patched);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

// Prioridade: SITE_URL > siteUrl do config > domínio de produção detectado pela Vercel.
function resolveSiteUrl(config) {
  const url =
    process.env.SITE_URL ||
    config.siteUrl ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    'http://localhost:3000';
  return String(url).replace(/\/+$/, '');
}

/** Tag do Google Analytics 4 (gtag.js), omitida no modo dev. */
function analyticsTag(id, dev) {
  if (!id || dev) return '';
  if (!/^G-[A-Z0-9]+$/i.test(id)) throw new BuildError(`googleAnalyticsId inválido: "${id}".`);
  return `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}');
  </script>`;
}

export async function build({ quiet = false, dev = false } = {}) {
  const started = performance.now();
  // Query string evita o cache de módulos ao reconstruir no modo dev.
  const config = (await import(`${pathToFileURL(PATHS.config).href}?t=${Date.now()}`)).default;
  const siteUrl = resolveSiteUrl(config);
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
  const templates = loadTemplates();
  dimensionCache.clear();

  const content = Object.fromEntries(SECTIONS.map((s) => [s, loadSection(s)]));

  fs.rmSync(PATHS.dist, { recursive: true, force: true });
  fs.mkdirSync(PATHS.dist, { recursive: true });

  const absolute = (src) => (/^https?:\/\//.test(src) ? src : `${siteUrl}${src}`);
  const common = {
    lang: config.lang,
    locale: config.locale,
    siteName: escapeHtml(config.name),
    twitter: escapeHtml(config.twitter || ''),
    email: escapeHtml(config.email),
    year: new Date().getFullYear(),
    socialLinks: socialLinks(config),
    buildId,
    analytics: analyticsTag(config.googleAnalyticsId, dev),
  };

  function page({ template, data = {}, title, description, url, image, ogType = 'website', current = '', bodyClass = '', extraHead = '' }) {
    const ogImage = image && OG_FORMATS.test(image.src) ? image : { src: config.ogImage, alt: config.title };
    const nav = {};
    for (const key of [...SECTIONS, 'contato']) {
      nav[`current_${key}`] = key === current ? ' aria-current="page"' : '';
    }
    const fragment = render(template, { ...common, ...data }, templates.partials);
    return render(
      templates.base,
      {
        ...common,
        ...nav,
        content: fragment,
        pageTitle: escapeHtml(title ? `${title} — ${config.name}` : config.title),
        pageDescription: escapeHtml(description || config.description),
        canonical: `${siteUrl}${url}`,
        ogType,
        ogImage: escapeHtml(absolute(ogImage.src)),
        ogImageAlt: escapeHtml(ogImage.alt),
        bodyClass,
        extraHead,
      },
      templates.partials
    );
  }

  const sitemapEntries = [{ loc: `${siteUrl}/` }];

  // Home
  const heroTitle = config.hero.lines
    .map((line, i) => `<span class="hero__line" style="--i:${i}">${escapeHtml(line)}</span>`)
    .join(' ');
  writeFile(
    'index.html',
    page({
      template: templates.home,
      url: '/',
      bodyClass: 'page-home',
      data: {
        heroKicker: escapeHtml(config.hero.kicker),
        heroTitle,
        heroSubtitle: escapeHtml(config.hero.subtitle),
        sectionBlocks: SECTIONS.map((s, i) => homeBlock(s, content[s], i, config)).join('\n\n'),
      },
    })
  );

  // Seções
  for (const section of SECTIONS) {
    const info = config.sections[section];
    const items = content[section];

    writeFile(
      `${section}/index.html`,
      page({
        template: templates.list,
        url: `/${section}`,
        title: info.title,
        description: info.intro,
        current: section,
        bodyClass: `page-list page-list--${section}`,
        data: {
          title: escapeHtml(info.title),
          intro: escapeHtml(info.intro),
          count: `${items.length} ${items.length === 1 ? 'item' : 'itens'}`,
          filters: filters(items),
          cards: items.map((item) => card(item)).join('\n'),
        },
      })
    );
    sitemapEntries.push({ loc: `${siteUrl}/${section}`, lastmod: items[0] ? isoDate(items[0].date) : undefined });

    items.forEach((item, index) => {
      const jsonLd =
        section === 'blog'
          ? `  <script type="application/ld+json">${JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: item.title,
              description: item.description,
              datePublished: item.date.toISOString(),
              author: { '@type': 'Person', name: config.name },
              image: item.cover ? absolute(item.cover.src) : undefined,
              mainEntityOfPage: `${siteUrl}${item.url}`,
            }).replace(/</g, '\\u003c')}</script>`
          : '';
      writeFile(
        `${section}/${item.slug}.html`,
        page({
          template: templates.item,
          url: item.url,
          title: item.title,
          description: item.description,
          image: item.cover,
          ogType: 'article',
          current: section,
          bodyClass: `page-item page-item--${section}`,
          extraHead: [
            `  <meta property="article:published_time" content="${item.date.toISOString()}">`,
            ...item.tags.map((t) => `  <meta property="article:tag" content="${escapeHtml(t)}">`),
            jsonLd,
          ]
            .filter(Boolean)
            .join('\n'),
          data: {
            section,
            sectionTitle: escapeHtml(info.title),
            title: escapeHtml(item.title),
            description: escapeHtml(item.description),
            meta: metaList(item),
            actions: itemActions(item),
            hero: itemHero(item),
            body: item.html,
            gallery: gallery(item),
            tags: tagList(item.tags, 'tags tags--item'),
            pager: pager(items, index),
          },
        })
      );
      sitemapEntries.push({ loc: `${siteUrl}${item.url}`, lastmod: isoDate(item.date) });
    });
  }

  // Contato
  writeFile(
    'contato.html',
    page({
      template: templates.contact,
      url: '/contato',
      title: config.contact.title,
      description: config.contact.intro,
      current: 'contato',
      bodyClass: 'page-contact',
      data: {
        title: escapeHtml(config.contact.title),
        intro: escapeHtml(config.contact.intro),
        socialLinks: socialLinks(config, '      '),
      },
    })
  );
  sitemapEntries.push({ loc: `${siteUrl}/contato` });

  // 404
  writeFile(
    '404.html',
    page({
      template: templates.notFound,
      url: '/404',
      title: 'Página não encontrada',
      description: 'Esta página não existe.',
      bodyClass: 'page-404',
      extraHead: '  <meta name="robots" content="noindex">',
    })
  );

  // SEO
  writeFile('sitemap.xml', sitemap(sitemapEntries));
  writeFile('rss.xml', rss(content.blog, config, siteUrl));
  writeFile('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

  // Estáticos
  fs.cpSync(PATHS.css, path.join(PATHS.dist, 'css'), { recursive: true });
  fs.cpSync(PATHS.js, path.join(PATHS.dist, 'js'), { recursive: true });
  copyPublic();

  const total = Object.values(content).reduce((n, list) => n + list.length, 0);
  if (!quiet) {
    const summary = SECTIONS.map((s) => `${s}: ${content[s].length}`).join(' · ');
    console.log(`\u2713 Build concluído em ${Math.round(performance.now() - started)}ms (${total} itens — ${summary})`);
    console.log(`  URL base: ${siteUrl}`);
  }
  return { total };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  build().catch((error) => {
    console.error(`\n\u2717 Build falhou:\n  ${error instanceof BuildError ? error.message : error.stack}`);
    process.exit(1);
  });
}

export { BuildError };
