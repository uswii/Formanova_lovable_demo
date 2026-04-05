import React, { Suspense, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { Header } from "@/components/layout/Header";
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CADGate } from '@/components/CADGate';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { useAuth } from '@/contexts/AuthContext';
import { isOnboardingEnabled, isOnboardingWelcomeEnabled, isStudioOnboardingEnabled } from '@/lib/feature-flags';
import { isOnboardingComplete, isTosAgreed, markTosAgreed, markUploadInstructionsSeen } from '@/lib/onboarding-api';
import { trackUploadGuideViewed, trackUploadGuideAcknowledged } from '@/lib/posthog-events';
import { UploadGuideModal } from '@/components/studio/UploadGuideModal';
import { PostHogPageView } from '@/components/PostHogPageView';
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useVersionPolling } from '@/hooks/use-version-polling';

import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { Loader2 } from "lucide-react";


// Toast providers — deferred since toasts only fire on user interaction
const Toaster = lazyWithRetry(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazyWithRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));

// TooltipProvider is tiny — load eagerly to avoid blank flash on initial render
import { TooltipProvider } from "@/components/ui/tooltip";

// Decorative / non-critical components — lazy-loaded to reduce initial JS payload
const ThemeDecorations = lazyWithRetry(() => import("@/components/ThemeDecorations").then(m => ({ default: m.ThemeDecorations })));
const ScrollProgressIndicator = lazyWithRetry(() => import("@/components/ScrollProgressIndicator").then(m => ({ default: m.ScrollProgressIndicator })));
const FloatingElements = lazyWithRetry(() => import("@/components/FloatingElements").then(m => ({ default: m.FloatingElements })));

/** Renders children only after the browser is idle — keeps decorative elements off the critical path */
function DeferredDecorations({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback(() => setReady(true));
    return () => cancelIdleCallback(id);
  }, []);
  if (!ready) return null;
  return <>{children}</>;
}

// Critical pages loaded eagerly (landing + auth)
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";

// Lazy-loaded pages (split into separate chunks)
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Tutorial = lazyWithRetry(() => import("./pages/Tutorial"));
const FeedbackRedirect = lazyWithRetry(() => import("./pages/FeedbackRedirect"));
const PhotographyStudioCategories = lazyWithRetry(() => import("./pages/PhotographyStudioCategories"));
const UnifiedStudio = lazyWithRetry(() => import("./pages/UnifiedStudio"));
// PRESERVED: Old single-upload studio - uncomment to restore
// const JewelryStudio = lazyWithRetry(() => import("./pages/JewelryStudio"));
// PRESERVED: Batch upload studio - uncomment to restore batch workflow
// const CategoryUploadStudio = lazyWithRetry(() => import("@/components/bulk").then(m => ({ default: m.CategoryUploadStudio })));
const CADStudio = lazyWithRetry(() => import("./pages/CADStudio"));
const CADToCatalog = lazyWithRetry(() => import("./pages/CADToCatalog"));
const TextToCAD = lazyWithRetry(() => import("./pages/TextToCAD"));
const Generations = lazyWithRetry(() => import("./pages/Generations"));
const Credits = lazyWithRetry(() => import("./pages/Credits"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazyWithRetry(() => import("./pages/PaymentCancel"));
const PromoAdminPage = lazyWithRetry(() => import("./pages/PromoAdminPage"));
const AdminFeedbackPage = lazyWithRetry(() => import("./pages/AdminFeedbackPage"));
const AdminModelsPage = lazyWithRetry(() => import("./pages/AdminModelsPage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const AIJewelryPhotoshoot = lazyWithRetry(() => import("./pages/AIJewelryPhotoshoot"));
const AIJewelryCAD = lazyWithRetry(() => import("./pages/AIJewelryCAD"));
const LinkAccount = lazyWithRetry(() => import("./pages/LinkAccount"));
const RolePicker = lazyWithRetry(() => import("./pages/RolePicker"));
const OnboardingWelcome = lazyWithRetry(() => import("./pages/OnboardingWelcome"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/** Handles post-reload redirect + success toast when returning from a chunk error during generation */
function PostReloadHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = sessionStorage.getItem('post_reload_redirect');
    const message = sessionStorage.getItem('post_reload_message');
    if (redirect) {
      sessionStorage.removeItem('post_reload_redirect');
      sessionStorage.removeItem('post_reload_message');
      sessionStorage.removeItem('chunk_reload_attempted');
      navigate(redirect, { replace: true });
      if (message) {
        // Lazy-import toast to avoid adding to critical bundle
        import('@/hooks/use-toast').then(({ toast }) => {
          toast({
            title: 'Welcome back',
            description: message,
            duration: 8000,
          });
        });
      }
    }
  }, [navigate]);
  return null;
}

const ONBOARDING_PUBLIC_PATHS = [
  '/', '/login', '/oauth-callback', '/feedback', '/link',
  '/ai-jewelry-photoshoot', '/ai-jewelry-cad', '/ai-jewelry-photography-comparison',
];

/** Redirects unsigned users to /studio where the onboarding modal will block them. */
function TosRedirectHandler() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (initializing) return;
    if (!user) return;
    if (!isStudioOnboardingEnabled(user.email)) return;
    if (location.pathname === '/studio') return; // already at the gate
    if (isTosAgreed(user.id)) return;
    const isPublic = ONBOARDING_PUBLIC_PATHS.includes(location.pathname)
      || location.pathname.startsWith('/blog/');
    if (isPublic) return;
    navigate('/studio', { replace: true });
  }, [initializing, user?.id, location.pathname, navigate]);

  return null;
}

/** Redirects gated users to /onboarding before their first protected-page visit. */
function OnboardingRedirectHandler() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (initializing) return;
    if (!user) return;
    if (location.pathname === '/onboarding' || location.pathname === '/onboarding-welcome') return;
    if (!isOnboardingEnabled(user.email)) return;
    if (isOnboardingComplete(user.id)) return;
    const isPublic = ONBOARDING_PUBLIC_PATHS.includes(location.pathname)
      || location.pathname.startsWith('/blog/');
    if (isPublic) return;
    navigate('/onboarding', { replace: true });
  }, [initializing, user?.id, location.pathname, navigate]);

  return null;
}

const ONBOARDING_SKIP_PATHS = [
  '/', '/login', '/oauth-callback', '/feedback', '/link',
  '/onboarding', '/onboarding-welcome',
  '/ai-jewelry-photoshoot', '/ai-jewelry-cad', '/ai-jewelry-photography-comparison',
];

/** Shows the upload guide modal once to every new user. */
function GlobalOnboardingGate() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (initializing || !user || hasChecked.current) return;
    if (!isStudioOnboardingEnabled(user.email)) return;
    if (!location.pathname.startsWith('/studio/')) return;

    hasChecked.current = true;

    if (isTosAgreed(user.id)) return;

    setOpen(true);
    trackUploadGuideViewed();
  }, [initializing, user?.id, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setOpen(false);
    if (!user) return;
    markTosAgreed(user.id);
    trackUploadGuideAcknowledged();
    markUploadInstructionsSeen().catch(() => {});
  };

  return <UploadGuideModal open={open} onClose={handleClose} />;
}

const DEV_EMAILS = ['uswa@raresense.so', 'uswaashfaque@gmail.com'];

/** Dev test panel — always visible to dev emails, bottom-left of every page. */
function TestPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.email || !DEV_EMAILS.includes(user.email.toLowerCase())) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          if (user) localStorage.removeItem('formanova_onboarding_' + user.id);
          navigate('/onboarding');
        }}
        className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors"
      >
        ↩ role picker
      </button>
      <button
        type="button"
        onClick={() => {
          if (user) localStorage.removeItem('formanova_tos_' + user.id);
          window.location.href = '/studio';
        }}
        className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors"
      >
        ↩ upload guide
      </button>
    </div>
  );
}

/** Version-aware update banner — rendered via portal so Radix Dialog inert does not block it */
function VersionBanner() {
  const { updateAvailable, refresh, dismiss } = useVersionPolling();
  return createPortal(
    <UpdateBanner visible={updateAvailable} onRefresh={refresh} onDismiss={dismiss} />,
    document.body
  );
}

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CreditsProvider>
        <TooltipProvider>
          {/* Toasters deferred — only needed on user interaction */}
          <DeferredDecorations>
            <Suspense fallback={null}>
              <Toaster />
              <Sonner />
            </Suspense>
          </DeferredDecorations>
          <BrowserRouter>
            <PostHogPageView />
            <PostReloadHandler />
            <OnboardingRedirectHandler />
            <TosRedirectHandler />
            <GlobalOnboardingGate />
            <TestPanel />
            <VersionBanner />
            
            <DeferredDecorations>
              <Suspense fallback={null}>
                <FloatingElements />
                <ScrollProgressIndicator />
                <ThemeDecorations />
              </Suspense>
            </DeferredDecorations>
            <div className="min-h-screen flex flex-col relative z-10">
              <Header />
              <main className="flex-1">
              <ChunkErrorBoundary>
                
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Welcome />} />
                  <Route path="/feedback" element={<FeedbackRedirect />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/oauth-callback" element={<Auth />} />
                  <Route path="/ai-jewelry-photoshoot" element={<AIJewelryPhotoshoot />} />
                  <Route path="/ai-jewelry-cad" element={<AIJewelryCAD />} />
                  <Route path="/ai-jewelry-photography-comparison" element={<Navigate to="/blog/ai-jewelry-photography-comparison" replace />} />
                  <Route path="/link" element={<LinkAccount />} />
                  {/* <Route path="/tutorial" element={<Tutorial />} /> */}{/* hidden for now */}
                  
                  {/* Role picker — one-time "what best describes you?" screen, gated by feature flag */}
                  <Route path="/onboarding" element={<ProtectedRoute><RolePicker /></ProtectedRoute>} />
                  {/* Onboarding welcome — shown once after role selection; contains ToS gate */}
                  <Route path="/onboarding-welcome" element={<ProtectedRoute><OnboardingWelcome /></ProtectedRoute>} />

                  {/* Protected routes - require sign in */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/generations" element={<ProtectedRoute><Generations /></ProtectedRoute>} />
                  <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
                  <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
                  <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
                  <Route path="/studio" element={<ProtectedRoute><PhotographyStudioCategories /></ProtectedRoute>} />
                  <Route path="/studio/:type" element={<ProtectedRoute><UnifiedStudio /></ProtectedRoute>} />
                  {/* PRESERVED: Old single-upload route - uncomment to restore */}
                  {/* <Route path="/studio/:type" element={<ProtectedRoute><JewelryStudio /></ProtectedRoute>} /> */}
                  {/* PRESERVED: Batch upload route - uncomment to restore batch workflow */}
                  {/* <Route path="/studio/:type" element={<ProtectedRoute><CategoryUploadStudio /></ProtectedRoute>} /> */}
                  <Route path="/studio-cad" element={<ProtectedRoute><CADGate><CADStudio /></CADGate></ProtectedRoute>} />
                  <Route path="/cad-to-catalog" element={<ProtectedRoute><CADGate><CADToCatalog /></CADGate></ProtectedRoute>} />
                  <Route path="/text-to-cad" element={<ProtectedRoute><CADGate><TextToCAD /></CADGate></ProtectedRoute>} />
                  
                  {/* Admin routes */}
                  <Route path="/admin/promo-codes" element={<AdminRouteGuard><PromoAdminPage /></AdminRouteGuard>} />
                  <Route path="/admin/feedback" element={<AdminRouteGuard><AdminFeedbackPage /></AdminRouteGuard>} />
                  <Route path="/admin/models" element={<AdminRouteGuard><AdminModelsPage /></AdminRouteGuard>} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </ChunkErrorBoundary>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
        </CreditsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
