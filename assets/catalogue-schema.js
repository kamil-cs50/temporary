/*
 * BlackBox 2.0 catalogue-v2.json – reguły walidacji.
 * Wspólne dla strony (przeglądarka) i skryptu scripts/validate-catalogue.mjs (Node).
 *
 * Schemat ustalony na podstawie oficjalnego pliku
 * https://github.com/D3ATHLY/blackbox/blob/main/catalog/catalogue-v2.json
 * (schemaVersion 1): { revision:int, releases:[...], schemaVersion:1 }.
 * Każdy obiekt w "releases" to JEDEN plik z JEDNEGO źródła. Kilka źródeł/formatów
 * tego samego projektu = kilka wpisów z tym samym "gameId" (tak robi oficjalny katalog).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CatalogueSchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Pola obecne w 100% wpisów oficjalnego katalogu – wymagane.
  var REQUIRED = {
    id: 'string', titleId: 'string', sizeBytes: 'integer', provider: 'string',
    format: 'string', filename: 'string', url: 'url', sourceId: 'string',
    gameId: 'string', title: 'string', cover: 'url', hero: 'url', artworkLayout: 'string'
  };
  // Pola obecne we wszystkich wpisach, ale mogące mieć wartość null.
  var NULLABLE = {
    version: 'string', genre: 'string', publisher: 'string', releaseDate: 'string',
    tagline: 'string', description: 'string', coverFallback: 'url', heroFallback: 'url'
  };
  // Pola opcjonalne spotykane w oficjalnym katalogu.
  var OPTIONAL = {
    browserUrl: 'url', sha256: 'string', addedAt: 'string', sourceCheckedAt: 'string',
    consoleVerified: 'boolean', homeOrder: 'integer', pickOrder: 'integer', region: 'string',
    platform: 'string', notes: 'string', sourceVerification: 'string',
    browserAvailable: 'boolean', directAvailable: 'boolean'
  };

  var FORMATS = ['PKG', 'exFAT', 'FFPFSC'];
  var FORMAT_EXT = { PKG: 'pkg', exFAT: 'exfat', FFPFSC: 'ffpfsc' };
  // Pary provider/sourceId używane przez oficjalny katalog BlackBox 2.0.
  var KNOWN_SOURCES = { vikingfile: 'Vikingfile', archive: 'Archive.org' };
  var PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'example.net'];

  function isUrl(v) {
    if (typeof v !== 'string') return false;
    try { var u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; }
    catch (e) { return false; }
  }
  function typeOk(v, t) {
    switch (t) {
      case 'string': return typeof v === 'string';
      case 'integer': return typeof v === 'number' && Number.isInteger(v) && v >= 0;
      case 'boolean': return typeof v === 'boolean';
      case 'url': return isUrl(v);
    }
    return true;
  }
  function typeName(t) {
    return { string: 'tekst', integer: 'liczba całkowita ≥ 0', boolean: 'true/false', url: 'poprawny URL http(s)' }[t];
  }

  /**
   * @param {any} data  sparsowany JSON
   * @param {{revisionFile?: any}} [opts]
   * @returns {{errors:string[], warnings:string[]}}
   */
  function validate(data, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { errors: ['Główny element musi być obiektem { "revision", "releases", "schemaVersion" }.'], warnings: warnings };
    }
    if (!Number.isInteger(data.revision) || data.revision < 0) errors.push('"revision" musi być liczbą całkowitą ≥ 0.');
    if (data.schemaVersion !== 1) errors.push('"schemaVersion" musi mieć wartość 1 (BlackBox 2.0).');
    if (!Array.isArray(data.releases)) { errors.push('"releases" musi być tablicą.'); return { errors: errors, warnings: warnings }; }
    if (data.releases.length === 0) warnings.push('"releases" jest pusta – katalog nie pokaże żadnej aplikacji.');
    Object.keys(data).forEach(function (k) {
      if (['revision', 'releases', 'schemaVersion'].indexOf(k) < 0) warnings.push('Nieznane pole główne "' + k + '" – aplikacja je zignoruje.');
    });

    var ids = {}, groups = {};
    data.releases.forEach(function (r, i) {
      var where = 'releases[' + i + ']' + (r && r.id ? ' (' + r.id + ')' : '');
      if (!r || typeof r !== 'object' || Array.isArray(r)) { errors.push(where + ': wpis musi być obiektem.'); return; }

      Object.keys(REQUIRED).forEach(function (k) {
        if (!(k in r) || r[k] === null || r[k] === '') errors.push(where + ': brak wymaganego pola "' + k + '".');
        else if (!typeOk(r[k], REQUIRED[k])) errors.push(where + ': "' + k + '" musi być: ' + typeName(REQUIRED[k]) + '.');
      });
      Object.keys(NULLABLE).forEach(function (k) {
        if (!(k in r)) warnings.push(where + ': brak pola "' + k + '" (oficjalny katalog zawsze je ma – ustaw null, jeśli puste).');
        else if (r[k] !== null && !typeOk(r[k], NULLABLE[k])) errors.push(where + ': "' + k + '" musi być null albo: ' + typeName(NULLABLE[k]) + '.');
      });
      Object.keys(OPTIONAL).forEach(function (k) {
        if (k in r && r[k] !== null && r[k] !== '' && !typeOk(r[k], OPTIONAL[k])) errors.push(where + ': "' + k + '" musi być: ' + typeName(OPTIONAL[k]) + '.');
      });
      Object.keys(r).forEach(function (k) {
        if (!(k in REQUIRED) && !(k in NULLABLE) && !(k in OPTIONAL)) warnings.push(where + ': nieznane pole "' + k + '".');
      });

      if (typeof r.id === 'string') {
        if (ids[r.id] !== undefined) errors.push(where + ': zduplikowane "id" (również releases[' + ids[r.id] + ']). Każde wydanie musi mieć unikalne id.');
        ids[r.id] = i;
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(r.id)) warnings.push(where + ': "id" powinno składać się z małych liter, cyfr i "-" (jak w oficjalnym katalogu).');
      }
      if (typeof r.gameId === 'string' && !/^[a-z0-9][a-z0-9-]*$/.test(r.gameId)) warnings.push(where + ': "gameId" powinien być slugiem (małe litery, cyfry, "-").');
      if (typeof r.format === 'string') {
        if (FORMATS.indexOf(r.format) < 0) errors.push(where + ': nieobsługiwany "format" "' + r.format + '". Dozwolone: ' + FORMATS.join(', ') + ' (wielkość liter ma znaczenie).');
        else if (typeof r.filename === 'string' && !r.filename.toLowerCase().endsWith('.' + FORMAT_EXT[r.format])) warnings.push(where + ': "filename" powinien kończyć się na .' + FORMAT_EXT[r.format] + ' dla formatu ' + r.format + '.');
      }
      if (typeof r.titleId === 'string' && !/^(PPSA|CUSA)\d{5}$/.test(r.titleId)) warnings.push(where + ': "titleId" "' + r.titleId + '" nie ma standardowej postaci PPSA12345 / CUSA12345 – aplikacja może go wyświetlić, ale funkcje oparte o Title ID mogą nie działać.');
      if (typeof r.sourceId === 'string') {
        if (!KNOWN_SOURCES[r.sourceId]) warnings.push(where + ': sourceId "' + r.sourceId + '" nie występuje w oficjalnym katalogu (znane: ' + Object.keys(KNOWN_SOURCES).join(', ') + '). Aplikacja może nie rozpoznać tego źródła.');
        else if (r.provider !== KNOWN_SOURCES[r.sourceId]) warnings.push(where + ': dla sourceId "' + r.sourceId + '" oficjalny katalog używa provider "' + KNOWN_SOURCES[r.sourceId] + '".');
      }
      if (r.sha256 && !/^[a-f0-9]{64}$/i.test(r.sha256)) errors.push(where + ': "sha256" musi mieć 64 znaki hex albo być pusty "".');
      if (r.artworkLayout && r.artworkLayout !== 'wide') warnings.push(where + ': oficjalny katalog używa wyłącznie artworkLayout "wide".');
      if (r.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)) warnings.push(where + ': "releaseDate" powinien mieć format RRRR-MM-DD.');
      ['addedAt', 'sourceCheckedAt'].forEach(function (k) {
        if (r[k] && isNaN(Date.parse(r[k]))) warnings.push(where + ': "' + k + '" powinien być datą ISO 8601, np. 2026-11-26T00:00:00+00:00.');
      });
      ['url', 'browserUrl', 'cover', 'hero'].forEach(function (k) {
        if (isUrl(r[k])) {
          var host = new URL(r[k]).hostname;
          if (PLACEHOLDER_HOSTS.indexOf(host) >= 0) warnings.push(where + ': "' + k + '" to wciąż placeholder (' + host + ') – podmień przed publikacją.');
          if (new URL(r[k]).protocol === 'http:') warnings.push(where + ': "' + k + '" używa http – zalecany https.');
        }
      });
      if (r.sourceId === 'vikingfile' && !r.browserUrl) warnings.push(where + ': wpisy Vikingfile w oficjalnym katalogu mają też "browserUrl".');

      if (typeof r.gameId === 'string') (groups[r.gameId] = groups[r.gameId] || []).push(r);
    });

    Object.keys(groups).forEach(function (g) {
      var list = groups[g];
      var titles = {}; list.forEach(function (r) { titles[r.title] = 1; });
      if (Object.keys(titles).length > 1) warnings.push('gameId "' + g + '": różne "title" w wydaniach (' + Object.keys(titles).join(' / ') + ').');
    });

    if (opts.revisionFile !== undefined) {
      var rf = opts.revisionFile;
      if (!rf || !Number.isInteger(rf.revision)) errors.push('revision.json musi mieć postać {"revision": <liczba>}.');
      else if (rf.revision !== data.revision) warnings.push('revision.json (' + rf.revision + ') ≠ catalogue-v2.json (' + data.revision + '). Zwiększaj oba przy każdej zmianie.');
    }
    return { errors: errors, warnings: warnings };
  }

  /** Grupuje wydania po gameId -> lista aplikacji (kolejność jak w pliku). */
  function groupReleases(releases) {
    var map = {}, order = [];
    releases.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var key = r.gameId || r.id;
      if (!map[key]) { map[key] = { gameId: key, releases: [] }; order.push(key); }
      map[key].releases.push(r);
    });
    return order.map(function (k) { return map[k]; });
  }

  return { validate: validate, groupReleases: groupReleases, isUrl: isUrl, FORMATS: FORMATS, KNOWN_SOURCES: KNOWN_SOURCES };
});
