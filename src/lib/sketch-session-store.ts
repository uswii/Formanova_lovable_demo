export interface SketchSession {
  id: string;
  file: File;
  previewUrl: string;
  hint: string;
}

interface SketchItem {
  id: string;
  file: File;
  previewUrl: string;
  hint: string;
}

class SketchSessionStore {
  private items: SketchSession[] = [];

  set(sketches: SketchItem[]) {
    this.items = sketches.map((s) => ({
      id: s.id,
      file: s.file,
      previewUrl: s.previewUrl,
      hint: s.hint,
    }));
  }

  get(): SketchSession[] {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

export const sketchSessionStore = new SketchSessionStore();
