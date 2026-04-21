import { useState, useMemo, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { MeshItemData } from "@/components/text-to-cad/types";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";
import { cleanLayerName, detectLayerMaterial, MAT_ID_TO_DISPLAY } from "@/lib/layer-material-detect";

interface PDPMeshPanelProps {
  meshes: MeshItemData[];
  appliedMaterials?: Record<string, string>;
  onSelectMesh: (name: string, multi: boolean) => void;
  onApplyMaterial: (matId: string) => void;
}

export default function PDPMeshPanel({ meshes, appliedMaterials = {}, onSelectMesh, onApplyMaterial }: PDPMeshPanelProps) {
  const [search, setSearch] = useState("");
  const [matTab, setMatTab] = useState<"metal" | "gemstone">("metal");
  const [meshCollapsed, setMeshCollapsed] = useState(false);
  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  const lastClickedIdx = useRef<number>(-1);

  const selectedMeshes = useMemo(() => meshes.filter((m) => m.selected), [meshes]);
  const hasSelection = selectedMeshes.length > 0;

  const filtered = useMemo(
    () => meshes.filter((m) =>
      cleanLayerName(m.name).toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase())
    ),
    [meshes, search]
  );

  const filteredMaterials = useMemo(
    () => MATERIAL_LIBRARY.filter((m) => m.category === matTab),
    [matTab]
  );

  const handleMeshClick = (mesh: MeshItemData, e: React.MouseEvent) => {
    const idx = meshes.findIndex((m) => m.name === mesh.name);
    if (e.shiftKey && lastClickedIdx.current >= 0) {
      const start = Math.min(lastClickedIdx.current, idx);
      const end = Math.max(lastClickedIdx.current, idx);
      for (let i = start; i <= end; i++) {
        if (!meshes[i].selected) onSelectMesh(meshes[i].name, true);
      }
      return;
    }
    lastClickedIdx.current = idx;
    onSelectMesh(mesh.name, e.ctrlKey || e.metaKey);
  };

  const meshSubtitle = meshes.length > 0 ? `${meshes.length}` : "";

  if (materialCollapsed && meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <ColHeader title="Material" onToggle={() => setMaterialCollapsed(false)} />
        <ColHeader title="Layers" sub={meshSubtitle} onToggle={() => setMeshCollapsed(false)} />
        <div className="flex-1" />
      </div>
    );
  }
  if (materialCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <ColHeader title="Material" onToggle={() => setMaterialCollapsed(false)} />
        <div className="flex-1 flex flex-col min-h-0 border-t border-border">
          <SectionHeader title="Layers" subtitle={meshSubtitle} collapsed={false} onToggle={() => setMeshCollapsed(true)} />
          <MeshList search={search} setSearch={setSearch} filtered={filtered} meshes={meshes} appliedMaterials={appliedMaterials} onClick={handleMeshClick} />
        </div>
      </div>
    );
  }
  if (meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <div className="flex-1 flex flex-col min-h-0">
          <SectionHeader title="Material" subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""} collapsed={false} onToggle={() => setMaterialCollapsed(true)} />
          <MatContent hasSelection={hasSelection} matTab={matTab} setMatTab={setMatTab} filteredMaterials={filteredMaterials} onApplyMaterial={onApplyMaterial} />
        </div>
        <ColHeader title="Layers" sub={meshSubtitle} onToggle={() => setMeshCollapsed(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-card border-l border-border h-full">
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={45} minSize={20}>
          <div className="flex flex-col h-full">
            <SectionHeader title="Material" subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""} collapsed={false} onToggle={() => setMaterialCollapsed(true)} />
            <MatContent hasSelection={hasSelection} matTab={matTab} setMatTab={setMatTab} filteredMaterials={filteredMaterials} onApplyMaterial={onApplyMaterial} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={20}>
          <div className="flex flex-col h-full">
            <SectionHeader title="Layers" subtitle={meshSubtitle} collapsed={false} onToggle={() => setMeshCollapsed(true)} />
            <MeshList search={search} setSearch={setSearch} filtered={filtered} meshes={meshes} appliedMaterials={appliedMaterials} onClick={handleMeshClick} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SectionHeader({ title, subtitle, collapsed, onToggle }: { title: string; subtitle: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/20 border-b border-border flex-shrink-0">
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
      </span>
    </button>
  );
}

function ColHeader({ title, sub = "", onToggle }: { title: string; sub?: string; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/20 border-b border-border flex-shrink-0">
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

function MatContent({ hasSelection, matTab, setMatTab, filteredMaterials, onApplyMaterial }: {
  hasSelection: boolean;
  matTab: "metal" | "gemstone";
  setMatTab: (t: "metal" | "gemstone") => void;
  filteredMaterials: typeof MATERIAL_LIBRARY;
  onApplyMaterial: (matId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-3 pt-3 space-y-3 scrollbar-thin">
      {!hasSelection && (
        <div className="px-3 py-2 font-mono text-[10px] text-muted-foreground bg-muted/40 border border-border">
          Select a layer to assign material
        </div>
      )}
      <div className="flex border border-border">
        {(["metal", "gemstone"] as const).map((cat) => (
          <button key={cat} onClick={() => setMatTab(cat)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${matTab === cat ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {cat === "metal" ? "Metals" : "Gems"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {filteredMaterials.map((m) => (
          <button key={m.id} onClick={() => onApplyMaterial(m.id)} disabled={!hasSelection}
            className="py-2 px-1.5 text-center transition-all hover:bg-accent/50 active:scale-[0.97] bg-muted/20 border border-border/50 disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <div className="flex justify-center mb-1">
              <MaterialSphere category={m.category} preview={m.preview} size={24} />
            </div>
            <div className="text-[8px] truncate font-mono font-semibold text-muted-foreground group-hover:text-foreground leading-tight">{m.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MeshList({ search, setSearch, filtered, meshes, appliedMaterials, onClick }: {
  search: string; setSearch: (v: string) => void;
  filtered: MeshItemData[]; meshes: MeshItemData[];
  appliedMaterials: Record<string, string>;
  onClick: (mesh: MeshItemData, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <input type="text" placeholder="Search layers..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-1 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="text-center font-mono text-[10px] text-muted-foreground/50 py-5">
            {meshes.length === 0 ? "Load a GLB to see layers" : "No matching layers"}
          </div>
        )}
        {filtered.map((mesh) => {
          const detected = detectLayerMaterial(mesh.name);
          const cleaned = cleanLayerName(mesh.name) || mesh.name;
          const appliedMatId = appliedMaterials[mesh.name];
          const appliedDisplay = appliedMatId ? MAT_ID_TO_DISPLAY[appliedMatId] : undefined;
          const swatchColor = appliedDisplay ? appliedDisplay.color : detected.color;
          const baseLabel = detected.label === "Generic Metal" ? cleaned : detected.label;
          const displayLabel = appliedDisplay ? `${cleaned}_${appliedDisplay.label}` : baseLabel;
          return (
            <button key={mesh.name} onClick={(e) => onClick(mesh, e)}
              className={`w-full text-left px-3 py-2.5 mb-1 transition-all border ${mesh.selected ? "text-foreground bg-accent border-border" : "hover:bg-accent/50 text-foreground/80 border-transparent"} ${!mesh.visible ? "opacity-35" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: swatchColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate font-medium">
                    {!mesh.visible && "[H] "}{displayLabel}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
