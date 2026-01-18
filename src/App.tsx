import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import SelectCompany from "./pages/SelectCompany";
import Artikli from "./pages/sifarnici/Artikli";
import Partneri from "./pages/sifarnici/Partneri";
import KlasifikacijaArtikala from "./pages/sifarnici/KlasifikacijaArtikala";
import AtributiArtikala from "./pages/sifarnici/AtributiArtikala";
import AdminPanel from "./pages/admin/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/select-company" element={
                <ProtectedRoute requireCompany={false}>
                  <SelectCompany />
                </ProtectedRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/artikli" element={
                <ProtectedRoute>
                  <Artikli />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/partneri" element={
                <ProtectedRoute>
                  <Partneri />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/grupe" element={
                <ProtectedRoute>
                  <KlasifikacijaArtikala />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/atributi" element={
                <ProtectedRoute>
                  <AtributiArtikala />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requireAdmin>
                  <AdminPanel />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
