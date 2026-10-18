/**
 * Script global: menu, header, revelação no scroll, vídeos sob demanda,
 * filtros por tag e ano do rodapé. Módulos de página (hero e contato) são
 * carregados só quando a página precisa deles.
 */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Repassa o ?v= do build para os módulos importados dinamicamente (cache busting).
const version = new URL(import.meta.url).search;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* Menu ------------------------------------------------------------------- */
function initMenu() {
  const header = $('[data-header]');
  const toggle = $('[data-menu-toggle]');
  const panel = $('[data-menu]');
  if (!header || !toggle || !panel) return;

  const label = $('.nav__toggle-label', toggle);
  const desktop = window.matchMedia('(min-width: 860px)');
  let open = false;

  const setOpen = (value, { restoreFocus = false } = {}) => {
    open = value;
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Fechar' : 'Menu';
    panel.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (open) $('a', panel)?.focus({ preventScroll: true });
    else if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(!open));
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      setOpen(false, { restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab') return;
    // Mantém o foco dentro do header (logo, botão e links) enquanto o overlay está aberto.
    const focusables = $$('a[href], button', header);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches && open) setOpen(false);
  });
}

/* Header ----------------------------------------------------------------- */
function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

/* Revelação no scroll ---------------------------------------------------- */
function initReveal() {
  const elements = $$('.reveal');
  if (!elements.length) return;

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  // Pequeno escalonamento entre irmãos de uma mesma grade.
  elements.forEach((el) => {
    const siblings = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [];
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${(index % 3) * 90}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  elements.forEach((el) => observer.observe(el));
}

/* Vídeos ----------------------------------------------------------------- */
function loadVideo(video) {
  if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
}

function initVideos() {
  const videos = $$('video[data-src]:not(.card__preview)');
  if (videos.length) {
    if (!('IntersectionObserver' in window)) {
      videos.forEach(loadVideo);
    } else {
      // O arquivo só é atribuído (e reproduzido) quando o vídeo se aproxima da viewport.
      const observer = new IntersectionObserver(
        (entries) => {
          for (const { target: video, isIntersecting } of entries) {
            if (isIntersecting) {
              loadVideo(video);
              if (video.hasAttribute('data-autoplay') && !reducedMotion.matches) {
                video.play().catch(() => {});
              }
            } else if (!video.paused) {
              video.pause();
            }
          }
        },
        { rootMargin: '200px 0px' }
      );
      videos.forEach((video) => observer.observe(video));
    }
  }

  // Preview em vídeo nos cards do portfólio (hover com mouse ou foco por teclado).
  $$('.card[data-preview]').forEach((card) => {
    const video = $('.card__preview', card);
    if (!video) return;
    const start = () => {
      if (reducedMotion.matches) return;
      loadVideo(video);
      video.currentTime = 0;
      video
        .play()
        .then(() => card.classList.add('is-previewing'))
        .catch(() => {});
    };
    const stop = () => {
      card.classList.remove('is-previewing');
      video.pause();
    };
    card.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && start());
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', stop);
  });
}

/* Filtros por tag -------------------------------------------------------- */
function initFilters() {
  $$('[data-filter-root]').forEach((root) => {
    const buttons = $$('[data-filter]', root);
    if (!buttons.length) return;
    const cards = $$('.card', root);
    const status = $('[data-filter-status]', root);
    const empty = $('[data-filter-empty]', root);

    const apply = (tag, { updateUrl = true } = {}) => {
      let visible = 0;
      for (const card of cards) {
        const match = !tag || card.dataset.tags.split(' ').includes(tag);
        card.hidden = !match;
        if (match) {
          visible++;
          card.classList.add('is-visible');
        }
      }
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === tag)));
      if (empty) empty.hidden = visible > 0;

      const active = buttons.find((b) => b.dataset.filter === tag);
      const tagName = active?.firstChild?.textContent.trim();
      if (status) {
        status.textContent = `${visible} ${visible === 1 ? 'item' : 'itens'}${tag ? ` com a tag ${tagName}` : ''}`;
      }

      if (updateUrl) {
        const url = new URL(window.location.href);
        if (tag) url.searchParams.set('tag', tag);
        else url.searchParams.delete('tag');
        history.replaceState(null, '', url);
      }
    };

    buttons.forEach((button) =>
      button.addEventListener('click', () => {
        const tag = button.dataset.filter;
        // Clicar de novo na tag ativa volta para "Todos".
        apply(button.getAttribute('aria-pressed') === 'true' && tag ? '' : tag);
      })
    );

    const initial = new URLSearchParams(window.location.search).get('tag');
    if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial, { updateUrl: false });
  });
}

/* Rodapé ----------------------------------------------------------------- */
function initYear() {
  const year = String(new Date().getFullYear());
  $$('[data-year]').forEach((el) => {
    el.textContent = year;
  });
}

/* Módulos por página ----------------------------------------------------- */
function initPageModules() {
  const canvas = $('[data-hero-canvas]');
  if (canvas) {
    import(`./hero.js${version}`)
      .then(({ initHero }) => initHero(canvas, { reducedMotion }))
      .catch((error) => console.error('Hero:', error));
  }

  const form = $('[data-contact-form]');
  if (form) {
    import(`./contact.js${version}`)
      .then(({ initContact }) => initContact(form))
      .catch((error) => console.error('Contato:', error));
  }
}

initMenu();
initHeader();
initReveal();
initVideos();
initFilters();
initYear();
initPageModules();
