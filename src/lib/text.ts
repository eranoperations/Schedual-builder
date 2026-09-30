/** Typed ASCII quotes → Hebrew geresh / gershayim (PRODUCT_SPEC §10). */
export const hebrewQuotes = (s: string) =>
  s.replace(/(?<=[\u05D0-\u05EA])"(?=[\u05D0-\u05EA])/g, '״').replace(/(?<=[\u05D0-\u05EA])'/g, '׳')
