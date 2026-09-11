import type { ImageSource } from "expo-image";

const LOCAL: Record<string, number> = {
  wax: require("../assets/images/categories/wax.png"),
  ankara: require("../assets/images/categories/ankara.png"),
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
  accessoires: require("../assets/images/categories/accessoires.png"),
};

export function categoryImageSource(cat: { slug?: string; image?: string | null }): ImageSource | undefined {
  const remote = String(cat.image || "").trim();
  if (remote && /^(https?:|data:|file:)/i.test(remote)) return { uri: remote };
  const slug = String(cat.slug || "").toLowerCase();
  if (LOCAL[slug]) return LOCAL[slug];
  if (remote) return { uri: remote };
  return undefined;
}
