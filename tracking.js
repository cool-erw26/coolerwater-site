/* Cooler Water — interaction tracking
 *
 * Provider-agnostic: sends to whatever is on the page (Vercel Analytics,
 * GA4, GTM) and stays silent if none of them are. Everything is wired
 * through observers and delegated listeners rather than by editing the
 * form logic, so this file can be changed or removed without touching
 * anything else.
 */
(function () {
  'use strict';

  function track(name, data) {
    var payload = data || {};
    try { if (window.va) window.va('event', { name: name, data: payload }); } catch (e) {}
    try { if (window.gtag) window.gtag('event', name, payload); } catch (e) {}
    try { if (window.dataLayer) window.dataLayer.push(Object.assign({ event: name }, payload)); } catch (e) {}
    if (window.COOLER_DEBUG) console.log('[track]', name, payload);
  }
  window.coolerTrack = track;   // so anything else can report an event

  var page = document.body.getAttribute('data-page') ||
             (location.pathname.indexOf('locations') > -1 ? 'locations' : 'home');

  // ── Scroll depth ────────────────────────────────────────────────────────
  // Fires once per threshold. Tells you how far down the page people get
  // before leaving — the quote form sits deep, so this is the main signal
  // for whether anyone is reaching it.
  (function () {
    var hit = {};
    var marks = [25, 50, 75, 100];
    function check() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0) return;
      var pct = Math.round((window.scrollY / h) * 100);
      marks.forEach(function (m) {
        if (pct >= m && !hit[m]) { hit[m] = true; track('scroll_depth', { page: page, depth: m }); }
      });
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { check(); ticking = false; });
    }, { passive: true });
  })();

  // ── Clicks: CTAs, city chips, outbound ──────────────────────────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a, button');
    if (!a) return;
    var label = (a.textContent || '').trim().slice(0, 40);

    if (a.classList.contains('inline-link') ||
        (a.hostname && a.hostname !== location.hostname && a.href.indexOf('mailto') !== 0)) {
      track('outbound_click', { page: page, to: a.hostname, label: label });
      return;
    }
    if (a.href && a.href.indexOf('mailto:') === 0) {
      track('email_click', { page: page });
      return;
    }
    if (a.classList.contains('geo-strip-chips') || a.closest('.geo-strip-chips')) {
      track('city_chip_click', { page: page, city: label });
      return;
    }
    if (/get a quote|request my quote|see how it works|see all locations/i.test(label) ||
        a.classList.contains('nav-cta') || a.classList.contains('btn-primary') ||
        a.classList.contains('loc-cta-btn') || a.classList.contains('submit-btn')) {
      track('cta_click', { page: page, label: label, where: a.closest('nav') ? 'nav' :
        a.closest('footer') ? 'footer' : a.closest('.hero') ? 'hero' : 'body' });
    }
  }, true);

  // ── Quote form ──────────────────────────────────────────────────────────
  var form = document.getElementById('quoteForm');
  if (!form) return;

  var started = false, startedAt = null, lastStep = 0;

  form.addEventListener('input', function () {
    if (started) return;
    started = true; startedAt = Date.now();
    track('form_start', { page: page });
  }, true);

  // Step reveals. Watched rather than wired into the reveal logic, so the
  // two stay independent.
  function watchSteps() {
    var steps = document.querySelectorAll('.form-step');
    if (!steps.length) return false;
    steps.forEach(function (el, i) {
      new MutationObserver(function () {
        if (el.classList.contains('form-step-locked')) return;
        var n = i + 1;
        if (n <= lastStep) return;
        lastStep = n;
        track('form_step', {
          page: page,
          step: n,
          title: (el.querySelector('.form-section-title') || {}).textContent || ''
        });
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    return true;
  }
  if (!watchSteps()) {
    // the reveal script builds .form-step wrappers at load; retry once it has
    var tries = 0;
    var t = setInterval(function () { if (watchSteps() || ++tries > 20) clearInterval(t); }, 150);
  }

  // Validation blocks — which field stopped them, and how often
  var errBox = document.getElementById('formError');
  if (errBox) {
    new MutationObserver(function () {
      if (errBox.style.display !== 'block') return;
      var flagged = [].slice.call(document.querySelectorAll('.field-invalid'))
        .map(function (el) { return el.id || el.className; }).join(',');
      track('form_validation_error', { page: page, fields: flagged, step: lastStep });
    }).observe(errBox, { attributes: true, attributeFilter: ['style'] });
  }

  // Successful submit, with how long it took
  var ok = document.getElementById('successBanner');
  if (ok) {
    new MutationObserver(function () {
      if (ok.style.display !== 'block') return;
      track('form_submit_success', {
        page: page,
        seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
        quantity: (document.querySelector('input[name="quantity"]:checked') || {}).value || '',
        variety: (document.getElementById('variety') || {}).value || '',
        useCase: (document.getElementById('useCase') || {}).value || '',
        timeline: (document.querySelector('input[name="timeline"]:checked') || {}).value || '',
        deliverySite: (document.getElementById('deliverySite') || {}).value || '',
        artwork: (document.getElementById('artworkStatus') || {}).value || '',
        recurring: !!(document.getElementById('recurringOrder') || {}).checked,
        multiDesign: !!(document.querySelector('input[name="multipleDesigns"]') || {}).checked,
        heardVia: (document.getElementById('hearAbout') || {}).value || ''
      });
    }).observe(ok, { attributes: true, attributeFilter: ['style'] });
  }

  // Choices worth knowing about even when the form is never submitted
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'timeline') track('timeline_choice', { page: page, value: t.value });
    if (t.name === 'recurringOrder' && t.checked) track('recurring_interest', { page: page });
    if (t.id === 'deliverySite' && t.value) track('delivery_site', { page: page, value: t.value });
    if (t.id === 'artworkStatus' && t.value) track('artwork_status', { page: page, value: t.value });
    if (t.id === 'fileUploadDirect' && t.files && t.files.length) {
      track('file_attach', { page: page, count: t.files.length });
    }
  });

  // Left mid-form without submitting — the number you actually want
  window.addEventListener('pagehide', function () {
    if (!started || (ok && ok.style.display === 'block')) return;
    track('form_abandon', { page: page, lastStep: lastStep });
  });
})();
