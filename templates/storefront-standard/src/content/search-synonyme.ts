/**
 * Redaktionelle Begriffsentsprechungen für die Storefront-Suche.
 *
 * Die Liste wirkt nur auf den lokalen Abgleich bereits geladener Katalogdaten
 * und verändert nichts am Shopsystem. Standardmäßig sind nur allgemeine
 * deutsch/englische Entsprechungen hinterlegt — eigene Fachbegriffe hier
 * ergänzen.
 */
export const searchSynonyms: Record<string, string[]> = {
  oil: ["öl"],
  oils: ["öl"],
  care: ["pflege"],
  skin: ["pflege", "haut"],
  soap: ["seife"],
  perfume: ["parfüm", "duft"],
  fragrance: ["duft", "parfüm"],
  scent: ["duft"],
  tea: ["tee"],
  drink: ["getränk"],
  gift: ["geschenk"],
  gifts: ["geschenk"],
  new: ["neu", "neuheit"],
  sale: ["angebot", "reduziert"],
};
