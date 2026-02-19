import { useState, useMemo } from "react";
import type { MeshItemData } from "./types";

interface MeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onAction: (action: string) => void;
}

export default function MeshPanel({ meshes, onSelectMesh, onAction }: MeshPanelProps) {
  const [search, setSearch] = useState("");

  const totalVerts = useMemo(() => meshes.reduce((s, m) => s + m.verts, 0), [meshes]);
  const filtered = useMemo(
    () => meshes.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meshes, search]
  );

  return (
    <div
      className="w-[270px] flex-shrink-0 flex flex-col"
      style={{
        background: "linear-gradient(180deg, rgba(22,22,22,0.98) 0%, rgba(14,14,14,0.99) 100%)",
        borderLeft: "1px solid #2a2a2a",
        boxShadow: "-4px 0 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3.5"
        style={{
          borderBottom: "1px solid #2a2a2a",
          background: "linear-gradient(180deg, rgba(28,28,28,0.95) 0%, rgba(18,18,18,0.98) 100%)",
        }}
      >
        <h2 className="text-[13px] font-semibold tracking-[2px] text-white uppercase mb-2">Meshes</h2>
        <div className="text-[10px] text-[#666] mb-2">
          {meshes.length > 0 ? `${meshes.length} meshes | ${totalVerts.toLocaleString()} vertices` : "No model loaded"}
        </div>
        <input
          type="text"
          placeholder="Search meshes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md text-[11px] text-[#e0e0e0] placeholder:text-[#555] transition-all duration-200 focus:outline-none focus:border-white/15 focus:shadow-[0_0_10px_rgba(255,255,255,0.03)]"
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
        />
      </div>

      {/* Mesh list */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="text-center text-[10px] text-[#444] py-5">
            {meshes.length === 0 ? "Generate a ring to see meshes" : "No matching meshes"}
          </div>
        )}
        {filtered.map((mesh) => (
          <button
            key={mesh.name}
            onClick={(e) => onSelectMesh(mesh.name, e.shiftKey || e.ctrlKey || e.metaKey)}
            className={`w-full text-left px-3 py-2 mb-0.5 rounded cursor-pointer transition-all duration-150 ${
              mesh.selected
                ? "shadow-[0_0_10px_rgba(255,255,255,0.04)]"
                : "hover:bg-[#252525]"
            } ${!mesh.visible ? "opacity-35" : ""}`}
            style={{
              background: mesh.selected
                ? "linear-gradient(180deg, rgba(35,35,35,0.9) 0%, rgba(25,25,25,0.95) 100%)"
                : "transparent",
              border: mesh.selected
                ? "1px solid rgba(255,255,255,0.3)"
                : "1px solid transparent",
            }}
          >
            <div className="text-[11px] text-[#ccc] mb-0.5 truncate">
              {!mesh.visible && "[H] "}{mesh.name}
            </div>
            <div className="text-[9px] text-[#666]">
              {mesh.verts} verts / {mesh.faces} faces
            </div>
          </button>
        ))}
      </div>

      {/* Batch actions */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid #2a2a2a" }}>
        <h4 className="text-[9px] uppercase text-[#666] mb-2 tracking-[1.5px] font-semibold">Mesh Actions</h4>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {["Hide", "Show", "Show All", "Isolate"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(action.toLowerCase().replace(" ", "-"))}
              className="py-2 rounded-md text-[10px] text-[#999] text-center cursor-pointer transition-all duration-150 font-medium hover:text-white hover:border-white/10"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
            >
              {action}
            </button>
          ))}
        </div>
        <h4 className="text-[9px] uppercase text-[#666] mb-2 mt-2 tracking-[1.5px] font-semibold">Selection</h4>
        <div className="flex gap-1.5">
          {["All", "None", "Invert"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(`select-${action.toLowerCase()}`)}
              className="flex-1 py-2 rounded-md text-[10px] text-[#999] text-center cursor-pointer transition-all duration-150 font-medium hover:text-white hover:border-white/10"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
