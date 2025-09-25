let klanten = [
  { id: 1, naam: "Jan Jansen", email: "jan@example.com", telefoon: "0470 111 222" }
];
let honden = [
  {
    id: 1, klant_id: 1, naam: "Bo", ras: "Border Collie",
    chipnummer: "985112003456789", dierenarts_naam: "DAP Noord"
  }
];
let nextKlantId = 2;
let nextHondId = 2;

export default {
  // klanten
  async listKlanten() { return klanten; },
  async getKlant(id) { return klanten.find(k => k.id === id) || null; },
  async createKlant({ naam, email=null, telefoon=null }) {
    const k = { id: nextKlantId++, naam, email, telefoon };
    klanten.push(k); return k;
  },
  async updateKlant(id, patch) {
    const i = klanten.findIndex(k => k.id === id);
    if (i === -1) return null;
    klanten[i] = { ...klanten[i], ...patch }; return klanten[i];
  },
  async deleteKlant(id) {
    const n = klanten.length; klanten = klanten.filter(k => k.id !== id); return klanten.length < n;
  },

  // honden
  async listHonden() { return honden; },
  async createHond(data) {
    if (data.chipnummer && honden.some(h => h.chipnummer === data.chipnummer)) {
      throw new Error("Chipnummer bestaat al");
    }
    const h = { id: nextHondId++, ...data };
    honden.push(h); return h;
  }
};
