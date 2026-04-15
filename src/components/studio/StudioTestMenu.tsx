import React from 'react';

export function StudioTestMenu({ user, navigate, hasCheckedUploadGuide, hasCheckedProductShotGuide, setUploadGuideOpen, setProductShotGuideOpen }: {
  user: any;
  navigate: (path: string) => void;
  hasCheckedUploadGuide: React.MutableRefObject<boolean>;
  hasCheckedProductShotGuide: React.MutableRefObject<boolean>;
  setUploadGuideOpen: (v: boolean) => void;
  setProductShotGuideOpen: (v: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        {open ? 'v test' : '> test'}
      </button>
      {open && (
        <div className="flex flex-col items-start gap-1 pl-2 border-l border-border/20">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (user) localStorage.removeItem('formanova_upload_guide_v2_' + user.id);
              hasCheckedUploadGuide.current = false;
              setUploadGuideOpen(true);
            }}
            className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            upload guide
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (user) localStorage.removeItem('formanova_product_shot_guide_v1_' + user.id);
              hasCheckedProductShotGuide.current = false;
              setProductShotGuideOpen(true);
            }}
            className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            product shot guide
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (user) localStorage.removeItem('formanova_onboarding_' + user.id);
              navigate('/onboarding');
            }}
            className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            role picker
          </button>
        </div>
      )}
    </div>
  );
}
