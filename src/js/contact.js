/**
 * Formulário de contato: validação no cliente e envio via fetch para /api/contact.
 * Sem JavaScript, o formulário faz um POST comum e a função redireciona de volta
 * para /contato?status=ok|erro.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RULES = {
  name: (v) => (v.length < 2 ? 'Informe seu nome.' : v.length > 100 ? 'Nome muito longo.' : ''),
  email: (v) => (!EMAIL_RE.test(v) ? 'Informe um e-mail válido.' : ''),
  message: (v) =>
    v.length < 10 ? 'Escreva uma mensagem com pelo menos 10 caracteres.' : v.length > 5000 ? 'Mensagem muito longa.' : '',
};

export function initContact(form) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const submitLabel = submit.textContent;

  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = `form-status${type ? ` is-${type}` : ''}`;
  };

  const setFieldError = (name, message) => {
    const input = form.elements[name];
    if (!input) return;
    const id = `${name}-erro`;
    let error = document.getElementById(id);
    if (message) {
      if (!error) {
        error = document.createElement('p');
        error.id = id;
        error.className = 'field__error';
        input.insertAdjacentElement('afterend', error);
      }
      error.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
    } else {
      error?.remove();
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  };

  const validate = () => {
    let firstInvalid = null;
    for (const [name, rule] of Object.entries(RULES)) {
      const message = rule(form.elements[name].value.trim());
      setFieldError(name, message);
      if (message && !firstInvalid) firstInvalid = form.elements[name];
    }
    firstInvalid?.focus();
    return !firstInvalid;
  };

  // Revalida o campo ao sair dele, depois que o usuário já viu um erro.
  for (const name of Object.keys(RULES)) {
    form.elements[name].addEventListener('blur', (event) => {
      if (event.target.hasAttribute('aria-invalid')) setFieldError(name, RULES[name](event.target.value.trim()));
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'ok') setStatus('Mensagem enviada! Obrigado, respondo em breve.', 'success');
  if (params.get('status') === 'erro') {
    setStatus('Não foi possível enviar. Tente de novo ou escreva direto para o e-mail ao lado.', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    if (!validate()) return;

    submit.disabled = true;
    submit.textContent = 'Enviando…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        if (data.errors) {
          Object.entries(data.errors).forEach(([name, message]) => setFieldError(name, message));
        }
        throw new Error(data.error || 'Não foi possível enviar agora. Tente novamente em alguns minutos.');
      }

      form.reset();
      setStatus(data.message || 'Mensagem enviada! Obrigado, respondo em breve.', 'success');
    } catch (error) {
      const offline = error instanceof TypeError;
      setStatus(offline ? 'Sem conexão. Verifique sua internet e tente de novo.' : error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });
}
