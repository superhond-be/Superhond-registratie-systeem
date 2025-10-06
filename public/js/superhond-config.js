<script>
;(() => {
  const KEY = "superhond.apiBase";

  // Zet hier optioneel een fallback (handig bij eerste deploy)
  const FALLBACK = ""; // bv: "https://script.google.com/macros/s/XXX/exec"

  function get() {
    const fromLS = localStorage.getItem(KEY);
    return (fromLS && fromLS.trim()) || FALLBACK || "";
  }

  function set(url) {
    const clean = String(url || "").trim();
    if (!/^https?:\/\/.+\/exec(\?.*)?$/.test(clean)) {
      throw new Error("Ongeldige Apps Script /exec URL.");
    }
    localStorage.setItem(KEY, clean);
    return clean;
  }

  // Globale helper
  window.SuperhondConfig = {
    getApiBase: get,
    setApiBase: set
  };
})();
</script>
