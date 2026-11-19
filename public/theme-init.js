/*
 * Anti-flash de tema: aplica a preferência salva antes do primeiro paint.
 * Arquivo externo (e não inline) para permitir CSP script-src 'self'.
 * Carregado de forma bloqueante no <head> (sem type="module" nem defer).
 * Migra a chave antiga "theme" para "afazeres:theme".
 */
(function () {
  try {
    var key = 'afazeres:theme';
    var t = localStorage.getItem(key);
    if (t === null) {
      var legacy = localStorage.getItem('theme');
      if (legacy === 'light' || legacy === 'dark') {
        localStorage.setItem(key, legacy);
        t = legacy;
      }
    }
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
