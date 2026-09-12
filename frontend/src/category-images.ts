import type { ImageSource } from "expo-image";

const LOCAL: Record<string, number> = {
  wax: require("../assets/images/categories/wax.png"),
  vlisco: require("../assets/images/categories/vlisco.png"),
  bazin: require("../assets/images/categories/bazin.png"),
  kente: require("../assets/images/categories/kente.png"),
  kita: require("../assets/images/categories/kita.png"),
  bogolan: require("../assets/images/categories/bogolan.png"),
  indigo: require("../assets/images/categories/indigo.png"),
  "aso-oke": require("../assets/images/categories/aso-oke.png"),
  ndop: require("../assets/images/categories/ndop.png"),
  shweshwe: require("../assets/images/categories/shweshwe.png"),
  adire: require("../assets/images/categories/adire.png"),
  raphia: require("../assets/images/categories/raphia.png"),
  dentelle: require("../assets/images/categories/dentelle.png"),
  gabon: require("../assets/images/categories/gabon.png"),
  burkina: require("../assets/images/categories/burkina.png"),
  nigeria: require("../assets/images/categories/nigeria.png"),
  togo: require("../assets/images/categories/togo.png"),
  ghana: require("../assets/images/categories/ghana.png"),
  "cote-ivoire": require("../assets/images/categories/cote-ivoire.png"),
  benin: require("../assets/images/categories/benin.png"),
  accessoires: require("../assets/images/categories/accessoires.png"),
};

/** Local category cards for home hero crossfade (exclude accessoires for fabric focus). */
export const HERO_CATEGORY_IMAGES: number[] = [
  LOCAL.wax,
  LOCAL.vlisco,
  LOCAL.bazin,
  LOCAL.kente,
  LOCAL.kita,
  LOCAL.bogolan,
  LOCAL.indigo,
  LOCAL["aso-oke"],
  LOCAL.ndop,
  LOCAL.shweshwe,
  LOCAL.adire,
  LOCAL.raphia,
  LOCAL.dentelle,
  LOCAL.gabon,
  LOCAL.burkina,
  LOCAL.nigeria,
  LOCAL.togo,
  LOCAL.ghana,
  LOCAL["cote-ivoire"],
  LOCAL.benin,
];

function localKeyFromPath(path: string): string | null {
  const m = path.match(/\/(?:images\/categories\/)?([^/]+)\.(png|jpe?g|webp|gif)$/i);
  return m ? m[1].toLowerCase() : null;
}

/** Always prefer bundled category cards; API paths like /images/categories/x.png are not hosted. */
export function categoryImageSource(cat: {
  slug?: string;
  id?: string;
  name?: string;
  image?: string | null;
}): ImageSource | undefined {
  const slug = String(cat.slug || cat.id || "").toLowerCase().trim();
  if (slug && LOCAL[slug]) return LOCAL[slug];

  const remote = String(cat.image || "").trim();
  if (remote) {
    const fromPath = localKeyFromPath(remote);
    if (fromPath && LOCAL[fromPath]) return LOCAL[fromPath];
  }

  // Name fallbacks (API labels)
  const name = String(cat.name || "").toLowerCase();
  const nameMap: Record<string, string> = {
    wax: "wax",
    "wax africain": "wax",
    "wax hollandais": "vlisco",
    vlisco: "vlisco",
    bazin: "bazin",
    kente: "kente",
    kita: "kita",
    bogolan: "bogolan",
    indigo: "indigo",
    "aso oke": "aso-oke",
    ndop: "ndop",
    shweshwe: "shweshwe",
    adire: "adire",
    raphia: "raphia",
    dentelle: "dentelle",
    "tissus du gabon": "gabon",
    "tissus gabon": "gabon",
    "tissus burkina": "burkina",
    "tissus nigeria": "nigeria",
    "tissu togo": "togo",
    "tissu ghana": "ghana",
    "tissus côte d'ivoire": "cote-ivoire",
    "tissus cote d'ivoire": "cote-ivoire",
    "tissus bénin": "benin",
    "tissus benin": "benin",
    accessoires: "accessoires",
  };
  const mapped = nameMap[name];
  if (mapped && LOCAL[mapped]) return LOCAL[mapped];

  if (remote && /^(https?:|data:|file:)/i.test(remote)) return { uri: remote };
  return undefined;
}
