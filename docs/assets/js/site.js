/* ============================================================
   Elettroimpianti Moretti - site.js
   Vanilla, zero dependencies, no third-party requests.
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     FORM DELIVERY
     No backend exists yet. With FORM_ENDPOINT = null the quote
     form composes a prefilled WhatsApp message instead.
     Set it to a URL (Netlify function, Formspree, n8n webhook,
     ...) to POST the form as JSON instead of opening WhatsApp.
     ---------------------------------------------------------- */
  var FORM_ENDPOINT = null; // set to a URL to POST instead of WhatsApp

  var WHATSAPP_NUMBER = '393483819009';
  var FALLBACK_EMAIL = 'info@pec.elettroimpiantimoretti.it';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. header height -> scroll-margin + mobile panel ---------- */
  var header = document.querySelector('[data-header]');

  function syncHeaderHeight() {
    if (!header) return;
    var h = Math.round(header.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
  }
  syncHeaderHeight();
  if (header && 'ResizeObserver' in window) {
    new ResizeObserver(syncHeaderHeight).observe(header);
  } else {
    window.addEventListener('resize', syncHeaderHeight, { passive: true });
  }

  /* ---------- 2. sticky header state (IntersectionObserver, no scroll listener) ---------- */
  var sentinel = document.getElementById('header-sentinel');
  if (header && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ---------- 3. mobile navigation ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('nav-toggle');
  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function navIsMobile() {
    return toggle && getComputedStyle(toggle).display !== 'none';
  }

  function openNav() {
    if (!nav || !toggle) return;
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
    // wait one frame: the panel is still visibility:hidden when the class lands
    requestAnimationFrame(function () {
      var first = nav.querySelector(FOCUSABLE);
      if (first) first.focus();
    });
  }

  function closeNav(returnFocus) {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    if (returnFocus) toggle.focus();
  }

  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) closeNav(false); else openNav();
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && navIsMobile()) closeNav(false);
    });

    document.addEventListener('keydown', function (e) {
      if (!nav.classList.contains('is-open')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeNav(true);
        return;
      }

      if (e.key === 'Tab') {
        // focus trap. DOM order matters: the panel comes first, the toggle after it.
        var items = Array.prototype.slice.call(nav.querySelectorAll(FOCUSABLE))
          .filter(function (el) { return el.offsetParent !== null; });
        items.push(toggle);
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      closeNav(false);
    });

    window.addEventListener('resize', function () {
      if (!navIsMobile() && nav.classList.contains('is-open')) closeNav(false);
    }, { passive: true });
  }

  /* ---------- 4. reveal on scroll ---------- */
  var revealables = document.querySelectorAll('[data-reveal]');

  function showAll() {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-visible'); });
  }

  if (!revealables.length) {
    /* nothing to do */
  } else if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    // stagger within each group, so a row of cards arrives in sequence
    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      group.querySelectorAll('[data-reveal]').forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', Math.min(i, 5) * 70 + 'ms');
      });
    });

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
    reduceMotion.addEventListener && reduceMotion.addEventListener('change', function (e) {
      if (e.matches) showAll();
    });
  }

  /* ---------- 5. quote form ---------- */
  var form = document.getElementById('quote-form');
  if (form) {
    var status = document.getElementById('form-status');
    var statusDefault = status ? status.innerHTML : '';

    var RULES = {
      nome: {
        el: 'f-nome', err: 'e-nome',
        test: function (v) { return v.trim().length >= 2; },
        msg: 'Inserisci il tuo nome.'
      },
      telefono: {
        el: 'f-tel', err: 'e-tel',
        test: function (v) {
          var digits = v.replace(/[^\d]/g, '');
          return digits.length >= 8 && digits.length <= 15 && /^[\d\s+().\/-]+$/.test(v.trim());
        },
        msg: 'Inserisci un numero di telefono valido (almeno 8 cifre).'
      },
      email: {
        el: 'f-email', err: 'e-email', optional: true,
        test: function (v) { return v.trim() === '' || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); },
        msg: 'Controlla l\'indirizzo email: manca qualcosa.'
      },
      tipo: {
        el: 'f-tipo', err: 'e-tipo',
        test: function (v) { return v !== ''; },
        msg: 'Seleziona il tipo di intervento.'
      },
      zona: {
        el: 'f-zona', err: 'e-zona',
        test: function (v) { return v.trim().length >= 2; },
        msg: 'Indica il comune o la zona di Roma.'
      },
      messaggio: {
        el: 'f-msg', err: 'e-msg',
        test: function (v) { return v.trim().length >= 10; },
        msg: 'Descrivi brevemente l\'intervento (almeno 10 caratteri).'
      },
      privacy: {
        el: 'f-privacy', err: 'e-privacy', checkbox: true,
        test: function (v, el) { return el.checked; },
        msg: 'Per proseguire devi accettare l\'informativa privacy.'
      }
    };

    function fieldOf(rule) { return document.getElementById(rule.el); }

    function setError(rule, message) {
      var el = fieldOf(rule);
      var err = document.getElementById(rule.err);
      if (!el || !err) return;
      if (message) {
        el.setAttribute('aria-invalid', 'true');
        err.textContent = message;
        err.hidden = false;
      } else {
        el.removeAttribute('aria-invalid');
        err.textContent = '';
        err.hidden = true;
      }
    }

    function validate(name) {
      var rule = RULES[name];
      var el = fieldOf(rule);
      if (!el) return true;
      var ok = rule.test(rule.checkbox ? '' : el.value, el);
      setError(rule, ok ? null : rule.msg);
      return ok;
    }

    Object.keys(RULES).forEach(function (name) {
      var el = fieldOf(RULES[name]);
      if (!el) return;
      var ev = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'blur';
      el.addEventListener(ev, function () { validate(name); });
      // once a field is flagged, correct it live
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true') validate(name);
      });
    });

    function collect() {
      return {
        nome: document.getElementById('f-nome').value.trim(),
        telefono: document.getElementById('f-tel').value.trim(),
        email: document.getElementById('f-email').value.trim(),
        tipo: document.getElementById('f-tipo').value,
        zona: document.getElementById('f-zona').value.trim(),
        messaggio: document.getElementById('f-msg').value.trim()
      };
    }

    function composeMessage(d) {
      var lines = [
        'Richiesta di preventivo dal sito',
        '',
        'Nome: ' + d.nome,
        'Telefono: ' + d.telefono
      ];
      if (d.email) lines.push('Email: ' + d.email);
      lines.push('Intervento: ' + d.tipo);
      lines.push('Zona: ' + d.zona);
      lines.push('');
      lines.push(d.messaggio);
      return lines.join('\n');
    }

    function say(html, state) {
      if (!status) return;
      status.innerHTML = html;
      status.classList.remove('is-error', 'is-ok');
      if (state) status.classList.add(state);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = null;
      Object.keys(RULES).forEach(function (name) {
        if (!validate(name) && !firstBad) firstBad = fieldOf(RULES[name]);
      });

      if (firstBad) {
        say('Controlla i campi segnalati e riprova.', 'is-error');
        firstBad.focus();
        return;
      }

      var data = collect();
      var text = composeMessage(data);

      if (FORM_ENDPOINT) {
        say('Invio in corso...', null);
        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.reset();
          say('Richiesta inviata. Ti ricontattiamo al più presto.', 'is-ok');
        }).catch(function () {
          say('Invio non riuscito. Chiamaci allo 06 7211600 oppure scrivi a <a href="mailto:' +
              FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + '</a>.', 'is-error');
        });
        return;
      }

      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
      var win = window.open(url, '_blank', 'noopener');
      if (!win) window.location.href = url;
      say('Abbiamo aperto WhatsApp con la richiesta già compilata: premi invio per spedirla. ' +
          'Se non si è aperto, scrivi a <a href="mailto:' + FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + '</a>.', 'is-ok');
    });

    form.addEventListener('reset', function () {
      Object.keys(RULES).forEach(function (name) { setError(RULES[name], null); });
      say(statusDefault, null);
    });
  }

  /* ---------- 6. footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
