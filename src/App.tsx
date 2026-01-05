import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { ThemeDecorations } from "@/components/ThemeDecorations";
import { ScrollProgressIndicator } from '@/components/ScrollProgressIndicator';
import { FloatingElements } from '@/components/FloatingElements';

// Pages
import Welcome from "./pages/Welcome";
import Tutorial from "./pages/Tutorial";
import Studio from "./pages/Studio";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FloatingElements />
            <ScrollProgressIndicator />
            <ThemeDecorations />
            <div className="min-h-screen flex flex-col relative z-10">
              <Header />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Welcome />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/tutorial" element={<Tutorial />} />
                  <Route path="/studio" element={<Studio />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;