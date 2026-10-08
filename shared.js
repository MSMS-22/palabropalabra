/* Utilidades comunes de Pasatiempos: preferencias compartidas (tema, daltonismo, idioma) y caché sin conexión. */
(function () {
  const KEY = "pas.prefs";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const PAS = {
    prefs: read,
    setPrefs(patch) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(read(), patch))); } catch {} PAS.applyTheme(); },
    applyTheme() {
      const p = read(), r = document.documentElement;
      if (p.theme === "dark" || p.theme === "light") r.setAttribute("data-theme", p.theme); else r.removeAttribute("data-theme");
      r.dataset.cb = p.cb ? "1" : "0";
    },
    // lectura segura de claves propias de cada juego
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    registerSW(path) { if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register(path).catch(() => {}); },
  };
  window.PAS = PAS;
  PAS.applyTheme();
})();
