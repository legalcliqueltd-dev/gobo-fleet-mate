import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppDashboard from "./pages/app/AppDashboard";
import AuthLogin from "./pages/app/AuthLogin";
import AuthSignup from "./pages/app/AuthSignup";
import AppDemo from "./pages/app/AppDemo";
import TestSimulator from "./pages/app/TestSimulator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* App Routes */}
          <Route path="/app/dashboard" element={<AppDashboard />} />
          <Route path="/app/auth/login" element={<AuthLogin />} />
          <Route path="/app/auth/signup" element={<AuthSignup />} />
          <Route path="/app/demo" element={<AppDemo />} />
          <Route path="/app/test" element={<TestSimulator />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
