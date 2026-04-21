// Detect material name and flat display color from a GLB mesh/layer name.
// Reference: 3D Photography GLB Layer Naming Reference (case-insensitive, any separator).

export interface LayerMaterial {
  label: string;
  color: string; // hex
}

const FALLBACK: LayerMaterial = { label: 'Generic Metal', color: '#E8C84A' };

// Ordered from most-specific to least-specific so the first match wins.
const RULES: { pattern: RegExp; label: string; color: string }[] = [
  // ── Karat + alloy combos (most specific first) ──
  { pattern: /10k[t]?[-_.\s]*y(ellow)?[-_.\s]*g(old)?/i, label: '10K Yellow Gold', color: '#E8C84A' },
  { pattern: /14k[t]?[-_.\s]*y(ellow)?[-_.\s]*g(old)?/i, label: '14K Yellow Gold', color: '#E8C84A' },
  { pattern: /18k[t]?[-_.\s]*y(ellow)?[-_.\s]*g(old)?/i, label: '18K Yellow Gold', color: '#E8C84A' },
  { pattern: /22k[t]?[-_.\s]*y(ellow)?[-_.\s]*g(old)?/i, label: '22K Yellow Gold', color: '#E8C84A' },
  { pattern: /24k[t]?[-_.\s]*y(ellow)?[-_.\s]*g(old)?/i, label: '24K Yellow Gold', color: '#E8C84A' },
  { pattern: /10k[t]?[-_.\s]*(rose|pink)/i, label: '10K Rose Gold', color: '#C27C85' },
  { pattern: /14k[t]?[-_.\s]*(rose|pink)/i, label: '14K Rose Gold', color: '#C27C85' },
  { pattern: /18k[t]?[-_.\s]*(rose|pink)/i, label: '18K Rose Gold', color: '#C27C85' },
  { pattern: /10k[t]?[-_.\s]*white/i, label: '10K White Gold', color: '#D0CCC8' },
  { pattern: /14k[t]?[-_.\s]*white/i, label: '14K White Gold', color: '#D0CCC8' },
  { pattern: /18k[t]?[-_.\s]*white/i, label: '18K White Gold', color: '#D0CCC8' },
  // ── Named alloys ──
  { pattern: /yellow[-_.\s]?gold|ygold|y[-_.\s]gold|yg[-_.\s]|yellowgold/i, label: 'Yellow Gold', color: '#E8C84A' },
  { pattern: /rose[-_.\s]?gold|rgold|pink[-_.\s]?gold|rosegold/i, label: 'Rose Gold', color: '#C27C85' },
  { pattern: /white[-_.\s]?gold|wgold|whitegold/i, label: 'White Gold', color: '#D0CCC8' },
  // ── Other metals ──
  { pattern: /sterling|[\b_]925[\b_]/i, label: 'Sterling Silver', color: '#C0C0C0' },
  { pattern: /\bsilver\b|silvr/i, label: 'Silver', color: '#C0C0C0' },
  { pattern: /platinum|platnum|plat[-_.]/i, label: 'Platinum', color: '#D8D8D8' },
  { pattern: /palladium|paladium/i, label: 'Palladium', color: '#CED0D4' },
  { pattern: /titanium|titanum/i, label: 'Titanium', color: '#9EA3A8' },
  { pattern: /tungsten|wolfram/i, label: 'Tungsten', color: '#7A7D80' },
  { pattern: /stainless|steel/i, label: 'Stainless Steel', color: '#B0B3B6' },
  { pattern: /\bbrass\b/i, label: 'Brass', color: '#C9A84C' },
  { pattern: /\bbronze\b/i, label: 'Bronze', color: '#B08D57' },
  { pattern: /\bcopper\b/i, label: 'Copper', color: '#D4836A' },
  { pattern: /black[-_.\s]?metal|gunmetal/i, label: 'Black Metal', color: '#2A2A2A' },
  { pattern: /\bgold\b|gld/i, label: 'Gold', color: '#E8C84A' },
  // ── Gems (specific compound names before short keywords) ──
  { pattern: /center[-_.\s]?stone|centre[-_.\s]?stone|main[-_.\s]?stone/i, label: 'Center Stone', color: '#E8F0F8' },
  { pattern: /side[-_.\s]?stone/i, label: 'Side Stone', color: '#A8C4D4' },
  { pattern: /accent[-_.\s]?stone/i, label: 'Accent Stone', color: '#A0BCC8' },
  { pattern: /halo[-_.\s]?(stone|gem|bead)/i, label: 'Halo Stones', color: '#A8C4D4' },
  { pattern: /pav[eé][-_.\s]?(bead|gem)?/i, label: 'Pave Stones', color: '#A8C4D4' },
  { pattern: /diamond|dimond|daimond|diamnd/i, label: 'Diamond', color: '#E8F0F8' },
  { pattern: /\bruby\b|rubie/i, label: 'Ruby', color: '#E0115F' },
  { pattern: /emerald|emrald/i, label: 'Emerald', color: '#50C878' },
  { pattern: /sapphire|saphire/i, label: 'Sapphire', color: '#0F52BA' },
  { pattern: /\btopaz\b/i, label: 'Topaz', color: '#FFC87C' },
  { pattern: /\bgarnet\b/i, label: 'Garnet', color: '#9B111E' },
  { pattern: /amethyst|amethist/i, label: 'Amethyst', color: '#9966CC' },
  { pattern: /\bpearl\b|perl/i, label: 'Pearl', color: '#E8D8CC' },
  { pattern: /aquamarine/i, label: 'Aquamarine', color: '#7FFFD4' },
  { pattern: /tanzanite/i, label: 'Tanzanite', color: '#4D5BA9' },
  { pattern: /tourmaline/i, label: 'Tourmaline', color: '#4DC8B2' },
  { pattern: /morganite/i, label: 'Morganite', color: '#F5B7B1' },
  { pattern: /\bopal\b/i, label: 'Opal', color: '#D4E5F7' },
  { pattern: /turquoise/i, label: 'Turquoise', color: '#40E0D0' },
  { pattern: /\bonyx\b/i, label: 'Onyx', color: '#101010' },
  { pattern: /cubic[-_.\s]?zirconia|\bcz\b/i, label: 'Cubic Zirconia', color: '#B0C8D8' },
  { pattern: /moissanite|moissanit/i, label: 'Moissanite', color: '#B4C8D4' },
  { pattern: /\bmelee\b|\bmele\b/i, label: 'Melee', color: '#A0BCC8' },
  { pattern: /gemstone|gem(?:s\b|\b)|jewel|brill|crystal/i, label: 'Gemstone', color: '#E8F0F8' },
  { pattern: /\bstones?\b/i, label: 'Gemstone', color: '#E8F0F8' },
  // ── Ring components (default gold) ──
  { pattern: /\bband\b|\bshank\b|\bstrand\b/i, label: 'Band / Shank', color: '#E8C84A' },
  { pattern: /\bprongs?\b/i, label: 'Prong', color: '#E8C84A' },
  { pattern: /\bbezel\b/i, label: 'Bezel Setting', color: '#E8C84A' },
  { pattern: /\bbasket\b/i, label: 'Basket', color: '#E8C84A' },
  { pattern: /\bgallery\b/i, label: 'Gallery', color: '#E8C84A' },
  { pattern: /\bshoulder\b/i, label: 'Shoulder', color: '#E8C84A' },
  { pattern: /\bbridge\b/i, label: 'Bridge', color: '#E8C84A' },
  { pattern: /\bhalo\b/i, label: 'Halo Setting', color: '#E8C84A' },
  { pattern: /\bchannel\b/i, label: 'Channel Setting', color: '#E8C84A' },
  { pattern: /\bclaw\b/i, label: 'Claw', color: '#E8C84A' },
  { pattern: /setting[-_.\s]?head|\bhead\b/i, label: 'Head', color: '#E8C84A' },
];

// Strip common mesh-tool prefixes/suffixes before matching.
function stripName(name: string): string {
  return name
    .replace(/^(mesh|object|node|group|part|solid|body|component|geo)\s*\d*[-_.\s]*/i, '')
    .replace(/[-_.\s]+(left|right|top|bottom|front|back|inner|outer|upper|lower|\d+)$/i, '');
}

export function detectLayerMaterial(meshName: string): LayerMaterial {
  const stripped = stripName(meshName);
  for (const rule of RULES) {
    if (rule.pattern.test(stripped) || rule.pattern.test(meshName)) {
      return { label: rule.label, color: rule.color };
    }
  }
  return FALLBACK;
}
