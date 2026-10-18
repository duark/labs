// Configuração global do site. Edite aqui nome, textos, redes e introduções das seções.
export default {
  name: 'Duark',
  title: 'Duark — Graphic & Motion Designer',
  description:
    'Portfólio de Duark: graphic design, motion design e ferramentas criativas construídas com IA.',
  // Usada em sitemap, RSS e Open Graph. Na Vercel, a URL de produção é detectada
  // automaticamente; a variável de ambiente SITE_URL tem prioridade sobre tudo.
  siteUrl: 'https://duark.com.',
  lang: 'pt-BR',
  locale: 'pt_BR',
  email: 'kelysson@duark.com.br',
  twitter: '@duark',
  ogImage: '/media/og-default.png',

  social: [
    { label: 'Instagram', url: 'https://instagram.com/duark' },
    { label: 'Behance', url: 'https://behance.net/duark' },
    { label: 'Vimeo', url: 'https://vimeo.com/duark' },
    { label: 'GitHub', url: 'https://github.com/duark' },
    { label: 'LinkedIn', url: 'https://linkedin.com/in/duark' },
  ],

  hero: {
    kicker: 'Graphic designer · Motion designer · Ferramentas com IA',
    lines: ['Forma', 'em movimento.'],
    subtitle:
      'Identidades que se mexem, tipografia que respira e ferramentas que transformam código em linguagem visual.',
  },

  sections: {
    blog: {
      title: 'Blog',
      intro:
        'Textos sobre processo, ritmo, tipografia e o que aprendo construindo imagens que se movem.',
      itemLabel: 'Artigo',
    },
    projetos: {
      title: 'Projetos',
      intro:
        'Projetos autorais e experimentos visuais: o lugar onde testo ideias sem briefing.',
      itemLabel: 'Projeto',
    },
    portfolio: {
      title: 'Portfólio',
      intro:
        'Cases profissionais de graphic e motion design para marcas, festivais e estúdios.',
      itemLabel: 'Case',
    },
    labs: {
      title: 'Labs',
      intro:
        'Ferramentas e experimentos com IA e código criativo. Muitas rodam aqui mesmo, no navegador.',
      itemLabel: 'Ferramenta',
    },
  },

  contact: {
    title: 'Contato',
    intro:
      'Tem um projeto, uma vinheta, uma identidade ou uma ideia estranha? Escreva. Respondo em até dois dias úteis.',
  },
};
