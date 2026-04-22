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
  { id: "pdp-flat-yellow-gold",  label: "Yellow Gold",    color: "#F0D868", category: "metal" },
  { id: "pdp-flat-rose-gold",    label: "Rose Gold",      color: "#E0AAAF", category: "metal" },
  { id: "pdp-flat-white-gold",   label: "White Gold",     color: "#E8E4E0", category: "metal" },
  { id: "pdp-flat-silver",       label: "Silver",         color: "#D8D8DA", category: "metal" },
  { id: "pdp-flat-platinum",     label: "Platinum",       color: "#E4E4E8", category: "metal" },
  { id: "pdp-flat-palladium",    label: "Palladium",      color: "#E0E2E6", category: "metal" },
  { id: "pdp-flat-titanium",     label: "Titanium",       color: "#C0C5CA", category: "metal" },
  { id: "pdp-flat-tungsten",     label: "Tungsten",       color: "#A8ACAE", category: "metal" },
  { id: "pdp-flat-stainless",    label: "Stainless Steel",color: "#D0D4D8", category: "metal" },
  { id: "pdp-flat-brass",        label: "Brass",          color: "#E0C070", category: "metal" },
  { id: "pdp-flat-bronze",       label: "Bronze",         color: "#D0AA78", category: "metal" },
  { id: "pdp-flat-copper",       label: "Copper",         color: "#E8A090", category: "metal" },
  { id: "pdp-flat-black-metal",  label: "Black Metal",    color: "#505058", category: "metal" },
];

export const PDP_FLAT_GEMS: PDPFlatEntry[] = [
  { id: "pdp-flat-diamond",      label: "Diamond",        color: "#EEF4FC", category: "gemstone" },
  { id: "pdp-flat-ruby",         label: "Ruby",           color: "#F46080", category: "gemstone" },
  { id: "pdp-flat-emerald",      label: "Emerald",        color: "#78D898", category: "gemstone" },
  { id: "pdp-flat-sapphire",     label: "Sapphire",       color: "#5590DD", category: "gemstone" },
  { id: "pdp-flat-topaz",        label: "Topaz",          color: "#FFD898", category: "gemstone" },
  { id: "pdp-flat-garnet",       label: "Garnet",         color: "#C85060", category: "gemstone" },
  { id: "pdp-flat-amethyst",     label: "Amethyst",       color: "#B888E0", category: "gemstone" },
  { id: "pdp-flat-pearl",        label: "Pearl",          color: "#EEE0D8", category: "gemstone" },
  { id: "pdp-flat-aquamarine",   label: "Aquamarine",     color: "#98FFE0", category: "gemstone" },
  { id: "pdp-flat-tanzanite",    label: "Tanzanite",      color: "#7080C8", category: "gemstone" },
  { id: "pdp-flat-tourmaline",   label: "Tourmaline",     color: "#70D8C8", category: "gemstone" },
  { id: "pdp-flat-morganite",    label: "Morganite",      color: "#F8C8C4", category: "gemstone" },
  { id: "pdp-flat-opal",         label: "Opal",           color: "#DCF0FF", category: "gemstone" },
  { id: "pdp-flat-turquoise",    label: "Turquoise",      color: "#68E8DC", category: "gemstone" },
  { id: "pdp-flat-onyx",         label: "Onyx",           color: "#404048", category: "gemstone" },
  { id: "pdp-flat-cz",           label: "Cubic Zirconia", color: "#C8D8E8", category: "gemstone" },
  { id: "pdp-flat-moissanite",   label: "Moissanite",     color: "#C8D8E8", category: "gemstone" },
  { id: "pdp-flat-center-stone", label: "Center Stone",   color: "#EEF4FC", category: "gemstone" },
  { id: "pdp-flat-side-stone",   label: "Side Stone",     color: "#C0D4E4", category: "gemstone" },
  { id: "pdp-flat-accent-stone", label: "Accent Stone",   color: "#B8CCD8", category: "gemstone" },
  { id: "pdp-flat-halo-stones",  label: "Halo Stones",    color: "#C0D4E4", category: "gemstone" },
  { id: "pdp-flat-pave",         label: "Pave Stones",    color: "#C0D4E4", category: "gemstone" },
  { id: "pdp-flat-melee",        label: "Melee",          color: "#B8CCD8", category: "gemstone" },
  { id: "pdp-flat-gem",          label: "Generic Gemstone",color: "#EEF4FC", category: "gemstone" },
];

const _all = [...PDP_FLAT_METALS, ...PDP_FLAT_GEMS];

// Lookup map for PDPMeshPanel swatch display
export const PDP_FLAT_PALETTE_MAP = new Map<string, PDPFlatEntry>(
  _all.map((e) => [e.id, e])
);

// MeshBasicMaterial — renders the exact hex color, unaffected by scene lighting or HDRI.
// This matches what the backend captureColorPreview function sees: the same hex colors
// without lighting variance, so viewport and rendered output are visually consistent.
_all.forEach((entry) => {
  if (MATERIAL_LIBRARY.find((m) => m.id === entry.id)) return;
  const def: MaterialDef = {
    id: entry.id,
    name: entry.label,
    category: entry.category,
    preview: entry.color,
    create: () => new THREE.MeshBasicMaterial({
      color: new THREE.Color(entry.color),
      side: THREE.DoubleSide,
    }) as any,
  };
  MATERIAL_LIBRARY.push(def);
});
