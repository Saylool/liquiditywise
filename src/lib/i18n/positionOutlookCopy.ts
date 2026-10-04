import type { Locale } from "./locales";

/*
 * The words under each open position that say how it has fared: its last
 * days against its own range, and the range this site would draw for the
 * pool now. Written as labels and counts rather than sentences, so no count
 * has a noun beside it that would have to agree with it in any language.
 */

export type PositionOutlookCopy = {
  readonly days: (days: string, inside: string, outside: string, crossed: string) => string;
  readonly suggested: (range: string) => string;
};

const COPY: Record<Locale, PositionOutlookCopy> = {
  en: {
    days: (days, inside, outside, crossed) =>
      `Last ${days} days — wholly inside this range: ${inside} · wholly outside: ${outside} · across an edge: ${crossed}`,
    suggested: (range) => `The range this site suggests for the pool now: ${range}`,
  },
  tr: {
    days: (days, inside, outside, crossed) =>
      `Son ${days} gün — tamamen bu aralığın içinde: ${inside} · tamamen dışında: ${outside} · bir kenarı geçtiği: ${crossed}`,
    suggested: (range) => `Bu sitenin havuz için şu an önerdiği aralık: ${range}`,
  },
  de: {
    days: (days, inside, outside, crossed) =>
      `Letzte ${days} Tage — ganz in diesem Bereich: ${inside} · ganz außerhalb: ${outside} · über eine Grenze hinweg: ${crossed}`,
    suggested: (range) => `Der Bereich, den diese Seite jetzt für den Pool vorschlägt: ${range}`,
  },
  es: {
    days: (days, inside, outside, crossed) =>
      `Últimos ${days} días — por completo dentro de este rango: ${inside} · por completo fuera: ${outside} · cruzando un borde: ${crossed}`,
    suggested: (range) => `El rango que este sitio sugiere ahora para el pool: ${range}`,
  },
  ar: {
    days: (days, inside, outside, crossed) =>
      `الأيام الأخيرة (${days}) — داخل هذا النطاق بالكامل: ${inside} · خارجه بالكامل: ${outside} · عبر إحدى حافتيه: ${crossed}`,
    suggested: (range) => `النطاق الذي يقترحه هذا الموقع للتجمّع الآن: ${range}`,
  },
  hi: {
    days: (days, inside, outside, crossed) =>
      `पिछले ${days} दिन — पूरी तरह इस दायरे के भीतर: ${inside} · पूरी तरह बाहर: ${outside} · किसी किनारे के आर-पार: ${crossed}`,
    suggested: (range) => `यह साइट अभी इस पूल के लिए यह दायरा सुझाती है: ${range}`,
  },
  zh: {
    days: (days, inside, outside, crossed) =>
      `最近 ${days} 天——完全在这个区间内：${inside} · 完全在区间外：${outside} · 越过边界：${crossed}`,
    suggested: (range) => `本站现在为这个资金池建议的区间：${range}`,
  },
  ru: {
    days: (days, inside, outside, crossed) =>
      `Последние дни (${days}) — целиком внутри этого диапазона: ${inside} · целиком вне: ${outside} · через границу: ${crossed}`,
    suggested: (range) => `Диапазон, который этот сайт сейчас предлагает для пула: ${range}`,
  },
  pt: {
    days: (days, inside, outside, crossed) =>
      `Últimos ${days} dias — totalmente dentro desta faixa: ${inside} · totalmente fora: ${outside} · cruzando uma borda: ${crossed}`,
    suggested: (range) => `A faixa que este site sugere agora para o pool: ${range}`,
  },
  "zh-Hant": {
    days: (days, inside, outside, crossed) =>
      `最近 ${days} 天——完全在這個區間內：${inside} · 完全在區間外：${outside} · 越過邊界：${crossed}`,
    suggested: (range) => `本站現在為這個資金池建議的區間：${range}`,
  },
};

export const getPositionOutlookCopy = (locale: Locale): PositionOutlookCopy => COPY[locale];
