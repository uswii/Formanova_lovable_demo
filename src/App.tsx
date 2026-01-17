import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Header } from "@/components/layout/Header";
import { ThemeDecorations } from "@/components/ThemeDecorations";
import { ScrollProgressIndicator } from '@/components/ScrollProgressIndicator';
import { FloatingElements } from '@/components/FloatingElements';

// Pages
import Welcome from "./pages/Welcome";
import Tutorial from "./pages/Tutorial";
import PhotographyStudio from "./pages/PhotographyStudio";
import JewelryStudio from "./pages/JewelryStudio";
import CADStudio from "./pages/CADStudio";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
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
                <Route path="/tutorial" element={<Tutorial />} />
                <Route path="/studio" element={<PhotographyStudio />} />
                <Route path="/studio/:type" element={<JewelryStudio />} />
                <Route path="/studio-cad" element={<CADStudio />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;