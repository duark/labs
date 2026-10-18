/**
 * POST /api/contact
 *
 * Recebe { name, email, message, website } (JSON ou formulário comum), valida,
 * descarta spam pelo honeypot "website" e envia o e-mail pelo Resend.
 *
 * Variáveis de ambiente:
 *   RESEND_API_KEY  chave da API do Resend (obrigatória em produção)
 *   CONTACT_TO      e-mail(s) de destino, separados por vírgula (obrigatória)
 *   CONTACT_FROM    remetente; padrão "Portfólio <onboarding@resend.dev>"
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_BODY_BYTES = 20 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function parseRaw(raw, contentType) {
  if (!raw) return {};
  if (contentType.includes('application/json')) return JSON.parse(raw);
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  throw new Error('Tipo de conteúdo não suportado.');
}

/** Funciona tanto na Vercel (req.body já interpretado) quanto no servidor de dev. */
async function readBody(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return parseRaw(req.body, contentType);
    if (Buffer.isBuffer(req.body)) return parseRaw(req.body.toString('utf8'), contentType);
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Mensagem grande demais.');
    chunks.push(chunk);
  }
  return parseRaw(Buffer.concat(chunks).toString('utf8'), contentType);
}

function validate({ name, email, message }) {
  const errors = {};
  if (name.length < 2) errors.name = 'Informe seu nome.';
  else if (name.length > 100) errors.name = 'Nome muito longo.';
  if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'Informe um e-mail válido.';
  if (message.length < 10) errors.message = 'Escreva uma mensagem com pelo menos 10 caracteres.';
  else if (message.length > 5000) errors.message = 'Mensagem muito longa.';
  return errors;
}

function respond(res, status, payload, { asForm = false } = {}) {
  if (asForm) {
    // Envio sem JavaScript: volta para a página de contato com o resultado na URL.
    res.statusCode = 303;
    res.setHeader('Location', `/contato?status=${payload.ok ? 'ok' : 'erro'}`);
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const asForm = String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return respond(res, 400, { ok: false, error: 'Requisição inválida.' }, { asForm });
  }

  const data = {
    name: String(body.name || '').trim().replace(/[\r\n]+/g, ' '),
    email: String(body.email || '').trim(),
    message: String(body.message || '').trim(),
  };

  // Honeypot: humanos não veem esse campo. Respondemos "sucesso" para não dar pistas ao bot.
  if (String(body.website || '').trim() !== '') {
    return respond(res, 200, { ok: true, message: 'Mensagem enviada! Obrigado.' }, { asForm });
  }

  const errors = validate(data);
  if (Object.keys(errors).length) {
    return respond(res, 422, { ok: false, error: 'Revise os campos destacados.', errors }, { asForm });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.CONTACT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!apiKey || !to.length) {
    if (!process.env.VERCEL) {
      // Desenvolvimento local sem chave: registra a mensagem no terminal.
      console.log('\n[contato] RESEND_API_KEY/CONTACT_TO ausentes. Mensagem recebida (não enviada):', data);
      return respond(res, 200, { ok: true, message: 'Mensagem recebida (modo local: veja o terminal).' }, { asForm });
    }
    console.error('[contato] RESEND_API_KEY ou CONTACT_TO não configurados.');
    return respond(res, 500, { ok: false, error: 'O envio de mensagens não está configurado.' }, { asForm });
  }

  const html = `
    <h2 style="margin:0 0 16px">Nova mensagem pelo portfólio</h2>
    <p><strong>Nome:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>E-mail:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
    <p><strong>Mensagem:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'Portfólio <onboarding@resend.dev>',
        to,
        reply_to: data.email,
        subject: `Novo contato: ${data.name}`,
        text: `Nome: ${data.name}\nE-mail: ${data.email}\n\n${data.message}`,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error('[contato] Resend respondeu', response.status, await response.text());
      return respond(res, 502, { ok: false, error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' }, { asForm });
    }
  } catch (error) {
    console.error('[contato] Falha ao chamar o Resend:', error);
    return respond(res, 502, { ok: false, error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' }, { asForm });
  }

  return respond(res, 200, { ok: true, message: 'Mensagem enviada! Obrigado, respondo em breve.' }, { asForm });
}
