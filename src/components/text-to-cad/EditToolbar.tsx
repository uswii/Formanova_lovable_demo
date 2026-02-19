import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EDIT_TOOLS, METAL_PRESETS, GEM_PRESETS } from "./types";

interface EditToolbarProps {
  onApplyMaterial: (preset: string) => void;
}

export default function EditToolbar({ onApplyMaterial }: EditToolbarProps) {
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [activeDisplayToggles, setActiveDisplayToggles] = useState<Set<string>>(new Set());

  const toggleFlyout = (flyout: string) => {
    setActiveFlyout((prev) => (prev === flyout ? null : flyout));
  };

  const toggleDisplay = (id: string) => {
    setActiveDisplayToggles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Vertical toolbar */}
      <div
        className="absolute top-[70px] left-0 z-[45] flex flex-col gap-0.5 px-1.5 py-2"
        style={{
          background: "linear-gradient(180deg, rgba(22,22,22,0.95) 0%, rgba(14,14,14,0.98) 100%)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.4)",
        }}
      >
        {EDIT_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => toggleFlyout(tool.flyout)}
            className={`w-[52px] h-[46px] flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer transition-all duration-150 relative group ${
              activeFlyout === tool.flyout
                ? "text-white shadow-[0_0_8px_rgba(255,255,255,0.04)]"
                : "text-[#666] hover:text-white hover:bg-[#252525]"
            }`}
            style={{
              background: activeFlyout === tool.flyout
                ? "linear-gradient(180deg, rgba(45,45,45,0.9) 0%, rgba(35,35,35,0.95) 100%)"
                : "transparent",
              border: "none",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <span className="text-[18px]">{tool.icon}</span>
            <span className="text-[7px] uppercase tracking-[0.5px] text-[#555] font-semibold">{tool.label}</span>
            {/* Tooltip */}
            <span className="hidden group-hover:block absolute left-[60px] top-1/2 -translate-y-1/2 z-50 text-[12px] text-[#e0e0e0] px-3.5 py-2 rounded-md whitespace-nowrap font-medium tracking-[0.3px] pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(35,35,35,0.95) 0%, rgba(25,25,25,0.98) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "4px 4px 16px rgba(0,0,0,0.5)",
              }}
            >
              {tool.tip}
            </span>
          </button>
        ))}
      </div>

      {/* Flyout panels */}
      <AnimatePresence>
        {activeFlyout && (
          <motion.div
            key={activeFlyout}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[46] overflow-y-auto max-h-[80vh] w-[280px] rounded-lg p-4"
            style={{
              left: "66px",
              top: activeFlyout === "transform" ? "56px"
                : activeFlyout === "mesh" ? "94px"
                : activeFlyout === "modifiers" ? "132px"
                : activeFlyout === "materials" ? "170px"
                : activeFlyout === "display" ? "208px"
                : activeFlyout === "sculpt" ? "246px"
                : "284px",
              background: "linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)",
              backdropFilter: "blur(25px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "8px 8px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            {activeFlyout === "transform" && <TransformFlyout />}
            {activeFlyout === "mesh" && <MeshFlyout />}
            {activeFlyout === "modifiers" && <ModifiersFlyout />}
            {activeFlyout === "materials" && <MaterialsFlyout onApply={onApplyMaterial} />}
            {activeFlyout === "display" && <DisplayFlyout toggles={activeDisplayToggles} onToggle={toggleDisplay} />}
            {activeFlyout === "sculpt" && <SculptFlyout />}
            {activeFlyout === "snap" && <SnapFlyout />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away */}
      {activeFlyout && (
        <div className="absolute inset-0 z-[44]" onClick={() => setActiveFlyout(null)} />
      )}
    </>
  );
}

// ── Flyout button style ──
function FoBtn({ children, shortcut, active, onClick }: {
  children: React.ReactNode; shortcut?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3.5 py-2.5 mb-1 rounded-md text-[12px] text-left cursor-pointer transition-all duration-150 font-medium ${
        active
          ? "text-white border-white/30 shadow-[0_0_8px_rgba(255,255,255,0.04)]"
          : "text-[#999] border-[#2a2a2a] hover:text-white"
      }`}
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(40,40,40,0.9) 0%, rgba(30,30,30,0.95) 100%)"
          : "transparent",
        border: `1px solid ${active ? "rgba(255,255,255,0.3)" : "#2a2a2a"}`,
        fontFamily: "Inter, sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          e.currentTarget.style.background = "linear-gradient(180deg, rgba(42,42,42,0.9) 0%, rgba(32,32,32,0.95) 100%)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "#2a2a2a";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {children}
      {shortcut && <kbd className="float-right text-[10px] text-[#555] font-semibold">{shortcut}</kbd>}
    </button>
  );
}

function FlyoutTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] text-white mb-3.5 font-bold uppercase tracking-[2px]">{children}</h3>;
}

function FlyoutSubtitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] text-[#666] mt-3.5 mb-2 uppercase tracking-[1.5px] font-semibold">{children}</h4>;
}

function FoSep() {
  return <div className="h-px bg-[#2a2a2a] my-2.5" />;
}

function NumInput({ label, color, id, step, value, min }: {
  label: string; color: string; id?: string; step: string; value: string; min?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="text-[13px] font-bold w-9 text-center rounded-md py-1" style={{ color }}>{label}</label>
      <input
        type="number"
        step={step}
        defaultValue={value}
        min={min}
        className="flex-1 px-2.5 py-1.5 rounded text-[11px] font-mono text-white focus:outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
    </div>
  );
}

// ── FLYOUT CONTENTS ──

function TransformFlyout() {
  return (
    <>
      <FlyoutTitle>Transform</FlyoutTitle>
      <FlyoutSubtitle>Position (precise)</FlyoutSubtitle>
      <NumInput label="X" color="#f44" step="0.001" value="0" />
      <NumInput label="Y" color="#4f4" step="0.001" value="0" />
      <NumInput label="Z" color="#48f" step="0.001" value="0" />
      <FlyoutSubtitle>Rotation (degrees)</FlyoutSubtitle>
      <NumInput label="RX" color="#f44" step="1" value="0" />
      <NumInput label="RY" color="#4f4" step="1" value="0" />
      <NumInput label="RZ" color="#48f" step="1" value="0" />
      <FlyoutSubtitle>Scale (per-axis)</FlyoutSubtitle>
      <NumInput label="SX" color="#f44" step="0.01" value="1" min="0.01" />
      <NumInput label="SY" color="#4f4" step="0.01" value="1" min="0.01" />
      <NumInput label="SZ" color="#48f" step="0.01" value="1" min="0.01" />
      <div className="flex items-center gap-2 mt-1 mb-2">
        <label className="text-[9px] text-white/50 w-9 text-center">Uniform</label>
        <input type="number" step="0.01" defaultValue="1" min="0.01"
          className="flex-1 px-2.5 py-1.5 rounded text-[11px] font-mono text-white focus:outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>
      <FlyoutSubtitle>Tools</FlyoutSubtitle>
      <FoBtn>Reset Transform</FoBtn>
      <FoBtn>Read from Selected</FoBtn>
      <FoSep />
      <FlyoutSubtitle>Mirror</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn>Mirror X</FoBtn>
        <FoBtn>Mirror Y</FoBtn>
        <FoBtn>Mirror Z</FoBtn>
      </div>
      <FlyoutSubtitle>Align</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn>Align X</FoBtn>
        <FoBtn>Align Y</FoBtn>
        <FoBtn>Align Z</FoBtn>
      </div>
      <FoBtn shortcut="Shift+D">Duplicate</FoBtn>
    </>
  );
}

function MeshFlyout() {
  return (
    <>
      <FlyoutTitle>Mesh</FlyoutTitle>
      <FoBtn shortcut="X">Delete Selected</FoBtn>
      <FoBtn shortcut="Shift+D">Duplicate</FoBtn>
      <FoBtn>Merge Selected</FoBtn>
      <FoBtn>Separate Loose Parts</FoBtn>
      <FoSep />
      <FoBtn>Flip Normals</FoBtn>
      <FoBtn>Center Origin</FoBtn>
      <FoBtn>Recalculate Normals</FoBtn>
    </>
  );
}

function ModifiersFlyout() {
  return (
    <>
      <FlyoutTitle>Modifiers</FlyoutTitle>
      <FlyoutSubtitle>Geometry</FlyoutSubtitle>
      <FoBtn>Subdivide (x1)</FoBtn>
      <FoBtn>Subdivide (x2)</FoBtn>
      <FoBtn>Smooth (3 iter)</FoBtn>
      <FoBtn>Smooth (10 iter)</FoBtn>
      <FlyoutSubtitle>Reduce</FlyoutSubtitle>
      <FoBtn>Decimate 50%</FoBtn>
      <FoBtn>Decimate 25%</FoBtn>
      <FoBtn>Decimate 10%</FoBtn>
      <FlyoutSubtitle>Mirror Modifier</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn>Mirror X</FoBtn>
        <FoBtn>Mirror Y</FoBtn>
        <FoBtn>Mirror Z</FoBtn>
      </div>
    </>
  );
}

function MaterialsFlyout({ onApply }: { onApply: (preset: string) => void }) {
  return (
    <>
      <FlyoutTitle>Materials</FlyoutTitle>
      <FlyoutSubtitle>Metals</FlyoutSubtitle>
      <div className="grid grid-cols-2 gap-1 mb-2">
        {METAL_PRESETS.map((m) => (
          <button
            key={m.id}
            onClick={() => onApply(m.name)}
            className="py-2 px-2.5 rounded-md text-[10px] text-[#999] text-center cursor-pointer transition-all duration-150 hover:text-white hover:border-white/10"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
              style={{ background: m.swatch, border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {m.name}
          </button>
        ))}
      </div>
      <FlyoutSubtitle>Gems</FlyoutSubtitle>
      <div className="grid grid-cols-2 gap-1 mb-2">
        {GEM_PRESETS.map((g) => (
          <button
            key={g.id}
            onClick={() => onApply(g.name)}
            className="py-2 px-2.5 rounded-md text-[10px] text-[#999] text-center cursor-pointer transition-all duration-150 hover:text-white hover:border-white/10"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
              style={{ background: g.swatch, border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {g.name}
          </button>
        ))}
      </div>
      <FoSep />
      <FlyoutSubtitle>Custom Material</FlyoutSubtitle>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Color</label>
        <input type="color" defaultValue="#D4AF37" className="w-9 h-7 rounded-md cursor-pointer" style={{ border: "1px solid #333", background: "none", padding: 0 }} />
      </div>
      <SliderRow label="Metalness" defaultValue={0.95} />
      <SliderRow label="Roughness" defaultValue={0.15} />
      <SliderRow label="Clearcoat" defaultValue={0.30} />
      <FoBtn>Apply Custom Material</FoBtn>
    </>
  );
}

function SliderRow({ label, defaultValue }: { label: string; defaultValue: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="text-[13px] font-bold w-20 flex-shrink-0">{label}</label>
      <input type="range" min="0" max="1" step="0.01" defaultValue={defaultValue} className="flex-1 h-[3px] accent-white" />
      <span className="text-[10px] text-[#888] w-9 text-right font-mono">{defaultValue.toFixed(2)}</span>
    </div>
  );
}

function DisplayFlyout({ toggles, onToggle }: { toggles: Set<string>; onToggle: (id: string) => void }) {
  return (
    <>
      <FlyoutTitle>Display</FlyoutTitle>
      {["Wireframe", "Flat Shading", "X-Ray", "Bounding Box", "Show Normals"].map((label) => (
        <FoBtn key={label} active={toggles.has(label)} onClick={() => onToggle(label)}>{label}</FoBtn>
      ))}
      <FoSep />
      <FoBtn>Toggle Auto-Rotate</FoBtn>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Exposure</label>
        <input type="range" min="0.1" max="3" step="0.05" defaultValue={1.2} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">1.2</span>
      </div>
    </>
  );
}

function SculptFlyout() {
  return (
    <>
      <FlyoutTitle>Sculpt</FlyoutTitle>
      <FoBtn>Grab</FoBtn>
      <FoBtn>Smooth</FoBtn>
      <FoBtn>Inflate</FoBtn>
      <FoBtn>Flatten</FoBtn>
      <FoSep />
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Size</label>
        <input type="range" min="0.02" max="1" step="0.01" defaultValue={0.2} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.20</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Strength</label>
        <input type="range" min="0.01" max="1" step="0.01" defaultValue={0.3} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.30</span>
      </div>
      <FoBtn>
        <span style={{ color: "#f80" }}>Enable Sculpt Mode</span>
      </FoBtn>
    </>
  );
}

function SnapFlyout() {
  return (
    <>
      <FlyoutTitle>Snap &amp; Pivot</FlyoutTitle>
      <FoBtn>Grid Snap: OFF</FoBtn>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Grid Size</label>
        <input type="range" min="0.01" max="0.5" step="0.01" defaultValue={0.1} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.10</span>
      </div>
      <FoSep />
      <FlyoutSubtitle>Pivot</FlyoutSubtitle>
      <FoBtn active>Median Point</FoBtn>
      <FoBtn>Individual Origins</FoBtn>
      <FoBtn>World Origin</FoBtn>
    </>
  );
}
