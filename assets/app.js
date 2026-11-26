(function () {
  'use strict';

  // Ścieżka względna – działa także w podkatalogu GitHub Pages (np. /temporary/).
  var CATALOG_PATH = 'catalog/catalogue-v2.json';
  var REVISION_PATH = 'catalog/revision.json';
  var CATALOG_URL = new URL(CATALOG_PATH, document.baseURI).href;

  var S = window.CatalogueSchema;
  var $ = function (id) { return document.getElementById(id); };
  var state = { apps: [], q: '', format: '', provider: '' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtSize(b) {
    if (typeof b !== 'number' || !isFinite(b) || b < 0) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i ? b.toFixed(b < 10 ? 2 : 1) : b) + ' ' + u[i];
  }
  function uniq(a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }); }
  function initials(t) { return (t || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?'; }
  function safeUrl(u) { return S.isUrl(u) ? u : null; }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function copy(text) {
    var done = function () { toast('Skopiowano do schowka'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { prompt('Skopiuj URL:', text); }
      ta.remove();
    }
  }

  function setStatus(html, cls) { var s = $('status'); s.className = 'status' + (cls ? ' ' + cls : ''); s.innerHTML = html; }

  // Grafika z bezpiecznym fallbackiem (placeholder z inicjałami, gdy obraz nie istnieje).
  function artHTML(url, fallbackUrl, title, cls) {
    var u = safeUrl(url), f = safeUrl(fallbackUrl);
    var ph = '<div class="ph">' + esc(initials(title)) + '</div>';
    if (!u && !f) return ph;
    return ph + '<img class="' + (cls || '') + '" loading="lazy" alt="" src="' + esc(u || f) + '"' +
      (u && f ? ' data-fallback="' + esc(f) + '"' : '') + '>';
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.dataset.fallback) { var f = img.dataset.fallback; delete img.dataset.fallback; img.src = f; }
    else img.remove();
  }, true);

  function appFromGroup(g) {
    var r0 = g.releases[0];
    return {
      gameId: g.gameId, releases: g.releases, title: r0.title, titleId: r0.titleId,
      tagline: r0.tagline, description: r0.description, cover: r0.cover, coverFallback: r0.coverFallback,
      hero: r0.hero, heroFallback: r0.heroFallback, publisher: r0.publisher, genre: r0.genre,
      releaseDate: r0.releaseDate,
      versions: uniq(g.releases.map(function (r) { return r.version; })),
      formats: uniq(g.releases.map(function (r) { return r.format; })),
      providers: uniq(g.releases.map(function (r) { return r.provider; })),
      sizes: g.releases.map(function (r) { return r.sizeBytes; }).filter(function (n) { return typeof n === 'number'; }),
      haystack: g.releases.map(function (r) { return [r.title, r.titleId, r.id, r.gameId, r.tagline, r.description, r.publisher, r.genre, r.filename, r.provider].join(' '); }).join(' ').toLowerCase()
    };
  }
  function sizeLabel(app) {
    if (!app.sizes.length) return '—';
    var mn = Math.min.apply(null, app.sizes), mx = Math.max.apply(null, app.sizes);
    return mn === mx ? fmtSize(mn) : fmtSize(mn) + ' – ' + fmtSize(mx);
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = state.apps.filter(function (a) {
      if (q && a.haystack.indexOf(q) < 0) return false;
      if (state.format && a.formats.indexOf(state.format) < 0) return false;
      if (state.provider && a.providers.indexOf(state.provider) < 0) return false;
      return true;
    });
    var grid = $('grid');
    if (!state.apps.length) { grid.innerHTML = '<div class="empty">Katalog nie zawiera jeszcze żadnych wpisów.</div>'; return; }
    if (!list.length) { grid.innerHTML = '<div class="empty">Brak wyników dla wybranych filtrów.</div>'; return; }
    grid.innerHTML = list.map(function (a) {
      var idx = state.apps.indexOf(a);
      return '<button class="card" type="button" data-idx="' + idx + '" aria-label="Szczegóły: ' + esc(a.title) + '">' +
        '<div class="card__art">' + artHTML(a.hero, a.heroFallback, a.title) + '</div>' +
        '<div class="card__body"><div class="icon">' + artHTML(a.cover, a.coverFallback, a.title) .replace('class="ph"', 'class="ph" style="font-size:16px"') + '</div>' +
        '<div><h3>' + esc(a.title) + '</h3><p>' + esc(a.tagline || a.description || '') + '</p></div></div>' +
        '<div class="card__meta">' +
          (a.versions.length ? '<span class="chip">v' + esc(a.versions.join(', ')) + '</span>' : '') +
          '<span class="chip">' + esc(sizeLabel(a)) + '</span>' +
          a.formats.map(function (f) { return '<span class="chip chip--red">' + esc(f) + '</span>'; }).join('') +
          '<span class="chip">' + a.releases.length + ' ' + (a.releases.length === 1 ? 'źródło' : 'źródła') + '</span>' +
        '</div></button>';
    }).join('');
  }

  function openDetails(app) {
    var body = $('detailsBody');
    var srcs = app.releases.map(function (r) {
      var u = safeUrl(r.url), b = safeUrl(r.browserUrl);
      return '<div class="source"><div>' +
        '<div class="source__name">' + esc(r.provider) + ' <span class="chip chip--red">' + esc(r.format) + '</span></div>' +
        '<div class="source__meta mono">' + esc(r.filename) + ' · ' + esc(fmtSize(r.sizeBytes)) + (r.version ? ' · v' + esc(r.version) : '') + '</div>' +
        '<div class="source__meta mono">id: ' + esc(r.id) + '</div>' +
        '</div><div class="source__btns">' +
        (u ? '<a class="btn btn--primary" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Otwórz źródło</a>' : '<span class="chip">brak URL</span>') +
        (u ? '<button class="btn" type="button" data-copy="' + esc(u) + '" title="Kopiuj link">Kopiuj</button>' : '') +
        (b && b !== u ? '<a class="btn" href="' + esc(b) + '" target="_blank" rel="noopener noreferrer">Strona</a>' : '') +
        '</div></div>';
    }).join('');
    body.innerHTML =
      '<div class="details__hero"><button class="details__close" type="button" data-close aria-label="Zamknij">×</button>' + artHTML(app.hero, app.heroFallback, app.title) + '</div>' +
      '<div class="details__content">' +
        '<div class="details__head"><div class="icon">' + artHTML(app.cover, app.coverFallback, app.title) + '</div>' +
        '<div><h2 id="dTitle">' + esc(app.title) + '</h2><div class="sub mono">' + esc(app.titleId) + ' · gameId: ' + esc(app.gameId) + '</div></div></div>' +
        (app.description ? '<p>' + esc(app.description) + '</p>' : '') +
        '<dl class="kv">' +
          '<div><dt>Identyfikator</dt><dd class="mono">' + esc(app.titleId) + '</dd></div>' +
          '<div><dt>Wersja</dt><dd>' + esc(app.versions.join(', ') || '—') + '</dd></div>' +
          '<div><dt>Rozmiar</dt><dd>' + esc(sizeLabel(app)) + '</dd></div>' +
          '<div><dt>Format</dt><dd>' + esc(app.formats.join(', ')) + '</dd></div>' +
          '<div><dt>Wydawca</dt><dd>' + esc(app.publisher || '—') + '</dd></div>' +
          '<div><dt>Data wydania</dt><dd>' + esc(app.releaseDate || '—') + '</dd></div>' +
        '</dl>' +
        '<h4>Dostępne źródła (' + app.releases.length + ')</h4><div class="sources">' + srcs + '</div>' +
      '</div>';
    var d = $('details');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }

  function fillSelect(sel, values) {
    var first = sel.options[0];
    sel.innerHTML = ''; sel.appendChild(first);
    values.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
  }

  function listHTML(items, max) {
    var shown = items.slice(0, max);
    return '<ul>' + shown.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
      (items.length > max ? '<div>…i ' + (items.length - max) + ' więcej. Uruchom <code>node scripts/validate-catalogue.mjs</code>.</div>' : '');
  }

  function load() {
    setStatus('Ładowanie katalogu…');
    fetch(CATALOG_PATH, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw { kind: 'http', msg: 'Serwer zwrócił HTTP ' + res.status + ' dla ' + CATALOG_PATH + '.' };
        return res.text();
      })
      .then(function (text) {
        var data;
        try { data = JSON.parse(text); }
        catch (e) { throw { kind: 'syntax', msg: 'Plik nie jest poprawnym JSON: ' + e.message }; }
        var v = S.validate(data);
        $('statRevision').textContent = Number.isInteger(data.revision) ? data.revision : '?';
        $('statSchema').textContent = data.schemaVersion != null ? 'v' + data.schemaVersion : '?';
        if (!Array.isArray(data.releases)) throw { kind: 'schema', msg: 'Brak tablicy "releases".', list: v.errors };

        state.apps = S.groupReleases(data.releases).map(appFromGroup);
        $('statApps').textContent = state.apps.length;
        $('statReleases').textContent = data.releases.length;
        fillSelect($('filterFormat'), uniq([].concat.apply([], state.apps.map(function (a) { return a.formats; }))).sort());
        fillSelect($('filterProvider'), uniq([].concat.apply([], state.apps.map(function (a) { return a.providers; }))).sort());

        if (v.errors.length) setStatus('<strong>Katalog zawiera błędy (' + v.errors.length + ') – BlackBox może go nie wczytać.</strong>' + listHTML(v.errors, 8), 'error');
        else if (v.warnings.length) setStatus('<strong>Ostrzeżenia (' + v.warnings.length + ')</strong>' + listHTML(v.warnings, 6), 'warn');
        else setStatus('');
        render();

        // Sprawdzenie zgodności z revision.json (informacyjne).
        fetch(REVISION_PATH, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rf) {
          if (rf && Number.isInteger(rf.revision) && rf.revision !== data.revision)
            toast('Uwaga: revision.json (' + rf.revision + ') ≠ katalog (' + data.revision + ')');
        }).catch(function () {});
      })
      .catch(function (err) {
        var msg = err && err.msg ? err.msg : 'Nie udało się pobrać katalogu (' + (err && err.message || err) + '). Jeśli otwierasz plik bezpośrednio z dysku (file://), uruchom lokalny serwer: python3 -m http.server';
        setStatus('<strong>Błąd ładowania katalogu</strong>' + esc(msg) + (err && err.list ? listHTML(err.list, 8) : '') +
          '<div style="margin-top:10px"><button class="btn" type="button" id="retry">Spróbuj ponownie</button></div>', 'error');
        $('grid').innerHTML = '';
        ['statApps', 'statReleases'].forEach(function (id) { $(id).textContent = '–'; });
      });
  }

  // Zdarzenia
  $('catalogUrl').textContent = CATALOG_URL;
  $('rawJson').href = CATALOG_PATH;
  $('copyUrl').addEventListener('click', function () { copy(CATALOG_URL); });
  $('search').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('filterFormat').addEventListener('change', function (e) { state.format = e.target.value; render(); });
  $('filterProvider').addEventListener('change', function (e) { state.provider = e.target.value; render(); });
  $('grid').addEventListener('click', function (e) {
    var c = e.target.closest('.card'); if (c) openDetails(state.apps[+c.dataset.idx]);
  });
  $('status').addEventListener('click', function (e) { if (e.target.id === 'retry') load(); });
  var dlg = $('details');
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    var c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy);
  });

  load();
})();
