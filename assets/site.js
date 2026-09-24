/* Pulsebay AI: menu, booking-form source tracking, and form submission (Google Sheet via Apps Script) */
(function () {
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwoSBXRSd44Qu0NHOhPGdVuTbE4-INzcNK310ShYi6f-9qvzPOBL_7r6H1W_SLMAxP3/exec';

  // Mobile menu
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open menu');
      }
    });
  }

  // Which button opened the form: every link to #book records its label
  // in the hidden "cta" field (kept in sessionStorage when it opens another page)
  var CTA_KEY = 'pbai-cta';
  function ctaLabel(a) {
    var text = a.textContent.replace(/\s+/g, ' ').trim();
    if (a.closest('.dd-menu')) return text + ' (menu)';
    if (a.closest('header')) return text + ' (header)';
    if (a.closest('footer')) return text + ' (footer)';
    return text;
  }
  function setCta(label) {
    var field = document.querySelector('#lead-form input[name="cta"]');
    if (field && label) field.value = label;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href !== '#book' && !/#book$/.test(href)) return;
    var label = ctaLabel(a);
    if (href === '#book' && document.getElementById('lead-form')) {
      setCta(label);
    } else {
      try { sessionStorage.setItem(CTA_KEY, JSON.stringify({ label: label, at: Date.now() })); } catch (err) {}
    }
  });
  try {
    var saved = JSON.parse(sessionStorage.getItem(CTA_KEY) || 'null');
    sessionStorage.removeItem(CTA_KEY);
    if (saved && location.hash === '#book' && Date.now() - saved.at < 5 * 60 * 1000) setCta(saved.label);
  } catch (err) {}

  // Booking form
  var form = document.getElementById('lead-form');
  if (!form) return;
  var formState = document.querySelector('[data-state="form"]');
  var sentState = document.querySelector('[data-state="sent"]');
  var submit = form.querySelector('button[type="submit"]');
  var error = form.querySelector('.form-error');
  var again = document.querySelector('[data-action="again"]');
  var label = submit.textContent;

  var defaultError = error.innerHTML;
  var messages = {
    validation: 'Please fill in your name, company, a valid work email, phone number and industry, then try again.',
    rejected: 'Your request couldn\'t be accepted. Please email us at <a href="mailto:ai@pulsebay.in">ai@pulsebay.in</a>.'
  };

  function showError(code) {
    error.innerHTML = messages[code] || defaultError;
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';

    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;

    // Simple form-encoded POST (no preflight); the script replies with JSON {ok, error}
    fetch(ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json();
    }).then(function (result) {
      if (result && result.ok) {
        var cta = form.elements.cta ? form.elements.cta.value : '';
        formState.hidden = true;
        sentState.hidden = false;
        form.reset();
        if (form.elements.cta) form.elements.cta.value = cta;
      } else {
        showError(result && result.error);
      }
    }).catch(function () {
      // network failure, timeout, or the script crashed and returned an HTML error page
      showError('network');
    }).then(function () {
      if (timer) clearTimeout(timer);
      submit.disabled = false;
      submit.textContent = label;
    });
  });

  if (again) {
    again.addEventListener('click', function () {
      sentState.hidden = true;
      formState.hidden = false;
      form.querySelector('input:not([type="hidden"])').focus();
    });
  }
})();
