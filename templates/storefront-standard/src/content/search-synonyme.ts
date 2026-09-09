/**
 * Redaktionelle Begriffsentsprechungen für die Storefront-Suche.
 * Die Liste wirkt nur auf den lokalen Abgleich bereits geladener Katalogdaten.
 * Sie verändert nichts am Shopsystem und darf jederzeit erweitert werden.
 */
export const searchSynonyms: Record<string, string[]> = {
  black: ["schwarz", "schwarzkümmel"],
  "black seed": ["schwarzkümmel"],
  "black cumin": ["schwarzkümmel"],
  blackseed: ["schwarzkümmel"],
  cumin: ["kümmel"],
  seed: ["kümmel", "samen"],
  oil: ["öl"],
  oils: ["öl"],
  date: ["dattel"],
  dates: ["dattel"],
  medjool: ["medjool", "dattel"],
  honey: ["honig"],
  perfume: ["parfüm", "duft"],
  perfumes: ["parfüm", "duft"],
  fragrance: ["duft", "parfüm"],
  scent: ["duft"],
  incense: ["räucher", "bakhoor"],
  bakhoor: ["räucher"],
  oud: ["oud", "duft"],
  musk: ["misk", "moschus"],
  care: ["pflege"],
  skin: ["pflege", "haut"],
  soap: ["seife"],
  toothbrush: ["miswak", "siwak"],
  siwak: ["miswak"],
  drink: ["getränk"],
  drinks: ["getränk"],
  tea: ["tee"],
  nuts: ["nuss"],
  nut: ["nuss"],
};
