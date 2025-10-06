/* superhond-config.js – centrale instellingen */
(() => {
  // 🚀 Vul hier de fallback in (je nieuwste Web-App-URL)
  const FALLBACK = "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  window.SuperhondConfig = {
    version: "v0.21.0",
    get apiBase() {
      return (
        localStorage.getItem("superhond.apiBase") ||
        FALLBACK
      );
    },
    set apiBase(url) {
      localStorage.setItem("superhond.apiBase", url);
    },
  };

  console.log("✅ Superhond-config geladen:", window.SuperhondConfig.apiBase);
})();
