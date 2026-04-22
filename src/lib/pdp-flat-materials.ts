import * as THREE from "three";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import type { MaterialDef } from "@/components/cad-studio/materials";

export interface PDPFlatEntry {
  id: string;
  label: string;
  color: string;
  category: "metal" | "gemstone";
}

export const PDP_FLAT_METALS: PDPFlatEntry[] = [
  { id: "pdp-flat-yellow-gold",  label: "Yellow Gold",    color: "#E8C84A", category: "metal" },
  { id: "pdp-flat-rose-gold",    label: "Rose Gold",      color: "#C27C85", category: "metal" },
  { id: "pdp-flat-white-gold",   label: "White Gold",     color: "#D0CCC8", category: "metal" },
  { id: "pdp-flat-silver",       label: "Silver",         color: "#C0C0C0", category: "metal" },
  { id: "pdp-flat-platinum",     label: "Platinum",       color: "#D8D8D8", category: "metal" },
  { id: "pdp-flat-palladium",    label: "Palladium",      color: "#CED0D4", category: "metal" },
  { id: "pdp-flat-titanium",     label: "Titanium",       color: "#9EA3A8", category: "metal" },
  { id: "pdp-flat-tungsten",     label: "Tungsten",       color: "#7A7D80", category: "metal" },
  { id: "pdp-flat-stainless",    label: "Stainless Steel",color: "#B0B3B6", category: "metal" },
  { id: "pdp-flat-brass",        label: "Brass",          color: "#C9A84C", category: "metal" },
  { id: "pdp-flat-bronze",       label: "Bronze",         color: "#B08D57", category: "metal" },
  { id: "pdp-flat-copper",       label: "Copper",         color: "#D4836A", category: "metal" },
  { id: "pdp-flat-black-metal",  label: "Black Metal",    color: "#2A2A2A", category: "metal" },
];

export const PDP_FLAT_GEMS: PDPFlatEntry[] = [
  { id: "pdp-flat-diamond",      label: "Diamond",        color: "#E8F0F8", category: "gemstone" },
  { id: "pdp-flat-ruby",         label: "Ruby",           color: "#E0115F", category: "gemstone" },
  { id: "pdp-flat-emerald",      label: "Emerald",        color: "#50C878", category: "gemstone" },
  { id: "pdp-flat-sapphire",     label: "Sapphire",       color: "#0F52BA", category: "gemstone" },
  { id: "pdp-flat-topaz",        label: "Topaz",          color: "#FFC87C", category: "gemstone" },
  { id: "pdp-flat-garnet",       label: "Garnet",         color: "#9B111E", category: "gemstone" },
  { id: "pdp-flat-amethyst",     label: "Amethyst",       color: "#9966CC", category: "gemstone" },
  { id: "pdp-flat-pearl",        label: "Pearl",          color: "#E8D8CC", category: "gemstone" },
  { id: "pdp-flat-aquamarine",   label: "Aquamarine",     color: "#7FFFD4", category: "gemstone" },
  { id: "pdp-flat-tanzanite",    label: "Tanzanite",      color: "#4D5BA9", category: "gemstone" },
  { id: "pdp-flat-tourmaline",   label: "Tourmaline",     color: "#4DC8B2", category: "gemstone" },
  { id: "pdp-flat-morganite",    label: "Morganite",      color: "#F5B7B1", category: "gemstone" },
  { id: "pdp-flat-opal",         label: "Opal",           color: "#D4E5F7", category: "gemstone" },
  { id: "pdp-flat-turquoise",    label: "Turquoise",      color: "#40E0D0", category: "gemstone" },
  { id: "pdp-flat-onyx",         label: "Onyx",           color: "#101010", category: "gemstone" },
  { id: "pdp-flat-cz",           label: "Cubic Zirconia", color: "#B0C8D8", category: "gemstone" },
  { id: "pdp-flat-moissanite",   label: "Moissanite",     color: "#B4C8D4", category: "gemstone" },
  { id: "pdp-flat-center-stone", label: "Center Stone",   color: "#E8F0F8", category: "gemstone" },
  { id: "pdp-flat-side-stone",   label: "Side Stone",     color: "#A8C4D4", category: "gemstone" },
  { id: "pdp-flat-accent-stone", label: "Accent Stone",   color: "#A0BCC8", category: "gemstone" },
  { id: "pdp-flat-halo-stones",  label: "Halo Stones",    color: "#A8C4D4", category: "gemstone" },
  { id: "pdp-flat-pave",         label: "Pave Stones",    color: "#A8C4D4", category: "gemstone" },
  { id: "pdp-flat-melee",        label: "Melee",          color: "#A0BCC8", category: "gemstone" },
  { id: "pdp-flat-gem",          label: "Generic Gemstone",color: "#E8F0F8", category: "gemstone" },
];

const _all = [...PDP_FLAT_METALS, ...PDP_FLAT_GEMS];

// Lookup map for PDPMeshPanel swatch display
export const PDP_FLAT_PALETTE_MAP = new Map<string, PDPFlatEntry>(
  _all.map((e) => [e.id, e])
);

// Push flat entries into MATERIAL_LIBRARY so CADCanvas.applyMaterial() can find them.
// MeshStandardMaterial(metalness:0) responds to lighting so geometry detail/form stays visible,
// but envMapIntensity:0 blocks the scene HDRI so there's no metallic sheen.
_all.forEach((entry) => {
  if (MATERIAL_LIBRARY.find((m) => m.id === entry.id)) return;
  const isGem = entry.category === "gemstone";
  const def: MaterialDef = {
    id: entry.id,
    name: entry.label,
    category: entry.category,
    preview: entry.color,
    create: () => {
      const c = new THREE.Color(entry.color);
      const mat = new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.35,
        metalness: 0,
        roughness: isGem ? 0.55 : 0.72,
        envMapIntensity: 0,
        side: THREE.DoubleSide,
      });
      return mat as any;
    },
  };
  MATERIAL_LIBRARY.push(def);
});
