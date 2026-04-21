import { useState, useMemo, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { MeshItemData } from "@/components/text-to-cad/types";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";
import { detectLayerMaterial } from "@/lib/layer-material-detect";

interface PDPMeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onApplyMaterial: (matId: string) => void;
}

export default function PDPMeshPanel({ meshes, onSelectMesh, onApplyMaterial }: PDPMeshPanelProps) {
  const [search, setSearch] = useState("");
  const [matTab, setMatTab] = useState<"metal" | "gemstone">("metal");
  const [meshCollapsed, setMeshCollapsed] = useState(false);
  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  const lastClickedIdx = useRef<number>(-1);

  const selectedMeshes = useMemo(() => meshes.filter((m) => m.selected), [meshes]);
  const hasSelection = selectedMeshes.length > 0;

  const filtered = useMemo(
    () => meshes.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meshes, search]
  );

  const filteredMaterials = useMemo(
    () => MATERIAL_LIBRARY.filter((m) => m.category === matTab),
    [matTab]
  );

  const handleMeshClick = (mesh: MeshItemData, e: React.MouseEvent) => {
    const currentIdx = meshes.findIndex((m) => m.name === mesh.name);
    if (e.shiftKey && lastClickedIdx.current >= 0) {
      const start = Math.min(lastClickedIdx.current, currentIdx);
      const end = Math.max(lastClickedIdx.current, currentIdx);
      for (let i = start; i <= end; i++) {
        if (!meshes[i].selected) onSelectMesh(meshes[i].name, true);
      }
      return;
    }
    lastClickedIdx.current = currentIdx;
    onSelectMesh(mesh.name, e.ctrlKey || e.metaKey);
  };

  const meshSubtitle = meshes.length > 0 ? `${meshes.length} layers` : "";

  if (materialCollapsed && meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-r border-border h-full">
        <CollapsedHeader title="Material" onToggle={() => setMaterialCollapsed(false)} />
        <CollapsedHeader title="Layers" subtitle={meshSubtitle} onToggle={() => setMeshCollapsed(false)} />
        <div className="flex-1" />
      </div>
    );
  }

  if (materialCollapsed) {
    return (
      <div className="flex flex-col bg-card border-r border-border h-full">
        <CollapsedHeader title="Material" onToggle={() => setMaterialCollapsed(false)} />
        <div className="flex-1 flex flex-col min-h-0 border-t border-border">
          <SectionHeader title="Layers" subtitle={meshSubtitle} collapsed={false} onToggle={() => setMeshCollapsed(true)} />
          <MeshTable search={search} setSearch={setSearch} filtered={filtered} meshes={meshes} onMeshClick={handleMeshClick} />
        </div>
      </div>
    );
  }

  if (meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-r border-border h-full">
        <div className="flex-1 flex flex-col min-h-0">
          <SectionHeader title="Material" subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""} collapsed={false} onToggle={() => setMaterialCollapsed(true)} />
          <MaterialContent hasSelection={hasSelection} matTab={matTab} setMatTab={setMatTab} filteredMaterials={filteredMaterials} onApplyMaterial={onApplyMaterial} />
        </div>
        <CollapsedHeader title="Layers" subtitle={meshSubtitle} onToggle={() => setMeshCollapsed(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-card border-r border-border h-full">
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={45} minSize={20}>
          <div className="flex flex-col h-full">
            <SectionHeader title="Material" subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""} collapsed={false} onToggle={() => setMaterialCollapsed(true)} />
            <MaterialContent hasSelection={hasSelection} matTab={matTab} setMatTab={setMatTab} filteredMaterials={filteredMaterials} onApplyMaterial={onApplyMaterial} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={20}>
          <div className="flex flex-col h-full">
            <SectionHeader title="Layers" subtitle={meshSubtitle} collapsed={false} onToggle={() => setMeshCollapsed(true)} />
            <MeshTable search={search} setSearch={setSearch} filtered={filtered} meshes={meshes} onMeshClick={handleMeshClick} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SectionHeader({ title, subtitle, collapsed, onToggle }: {
  title: string; subtitle: string; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-accent/20 border-b border-border flex-shrink-0"
    >
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
      </span>
    </button>
  );
}

function CollapsedHeader({ title, subtitle = "", onToggle }: { title: string; subtitle?: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-accent/20 border-b border-border flex-shrink-0"
    >
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

function MaterialContent({ hasSelection, matTab, setMatTab, filteredMaterials, onApplyMaterial }: {
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
      <div className="flex gap-0 border border-border">
        {(["metal", "gemstone"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setMatTab(cat)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150 ${
              matTab === cat ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat === "metal" ? "Metals" : "Gems"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {filteredMaterials.map((m) => (
          <button
            key={m.id}
            onClick={() => onApplyMaterial(m.id)}
            disabled={!hasSelection}
            className="py-2 px-1.5 text-center transition-all duration-200 hover:bg-accent/50 hover:text-foreground active:scale-[0.97] bg-muted/20 border border-border/50 disabled:opacity-30 disabled:cursor-not-allowed group"
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

function MeshTable({ search, setSearch, filtered, meshes, onMeshClick }: {
  search: string;
  setSearch: (v: string) => void;
  filtered: MeshItemData[];
  meshes: MeshItemData[];
  onMeshClick: (mesh: MeshItemData, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <input
          type="text"
          placeholder="Search layers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
        />
      </div>

      {/* Column header */}
      {filtered.length > 0 && (
        <div className="px-4 pb-1 flex items-center gap-2 flex-shrink-0">
          <span className="flex-1 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/50">Layer</span>
          <span className="w-20 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/50 truncate">Detected</span>
          <span className="w-4 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/50 text-center">RGB</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-1 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="text-center font-mono text-[10px] text-muted-foreground/50 py-5">
            {meshes.length === 0 ? "Load a GLB to see layers" : "No matching layers"}
          </div>
        )}
        {filtered.map((mesh) => {
          const detected = detectLayerMaterial(mesh.name);
          return (
            <button
              key={mesh.name}
              onClick={(e) => onMeshClick(mesh, e)}
              className={`w-full text-left px-3 py-2.5 mb-1 transition-all duration-200 border ${
                mesh.selected
                  ? "text-foreground bg-accent border-border"
                  : "hover:bg-accent/50 text-foreground/80 border-transparent"
              } ${!mesh.visible ? "opacity-35" : ""}`}
            >
              <div className="flex items-center gap-2">
                {/* Col 1: mesh name */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate font-medium">
                    {!mesh.visible && "[H] "}{mesh.name}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {mesh.verts}v / {mesh.faces}f
                  </div>
                </div>
                {/* Col 2: detected material label */}
                <div className="w-20 flex-shrink-0">
                  <span className="font-mono text-[8px] text-muted-foreground/70 leading-tight line-clamp-2">
                    {detected.label}
                  </span>
                </div>
                {/* Col 3: flat color swatch */}
                <div
                  className="w-4 h-4 flex-shrink-0 border border-border/60 rounded-sm"
                  style={{ backgroundColor: detected.color }}
                  title={`${detected.label} — ${detected.color}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
