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
import Magacini from "./pages/sifarnici/Magacini";
import OrganizacioneJedinice from "./pages/sifarnici/OrganizacioneJedinice";
import UlazniTroskovi from "./pages/sifarnici/UlazniTroskovi";
import AdminPanel from "./pages/admin/AdminPanel";
import KontniPlan from "./pages/racunovodstvo/KontniPlan";
import NaloziZaKnjizenje from "./pages/racunovodstvo/NaloziZaKnjizenje";
import GlavnaKnjiga from "./pages/racunovodstvo/GlavnaKnjiga";
import BrutoBilans from "./pages/racunovodstvo/BrutoBilans";
import KarticaKonta from "./pages/racunovodstvo/KarticaKonta";
import KarticePartnera from "./pages/racunovodstvo/KarticePartnera";
import Ponude from "./pages/prodaja/Ponude";
import Fakture from "./pages/prodaja/Fakture";
import Otpremnice from "./pages/prodaja/Otpremnice";
import UlazneFaktureUsluge from "./pages/nabavka/UlazneFaktureUsluge";
import UlazneFaktureRoba from "./pages/nabavka/UlazneFaktureRoba";
import Prijemnice from "./pages/magacin/Prijemnice";
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
              <Route path="/sifarnici/magacini" element={
                <ProtectedRoute>
                  <Magacini />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/org-jedinice" element={
                <ProtectedRoute>
                  <OrganizacioneJedinice />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/kontni-plan" element={
                <ProtectedRoute>
                  <KontniPlan />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/ulazni-troskovi" element={
                <ProtectedRoute>
                  <UlazniTroskovi />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requireAdmin>
                  <AdminPanel />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/nalozi" element={
                <ProtectedRoute>
                  <NaloziZaKnjizenje />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/glavna-knjiga" element={
                <ProtectedRoute>
                  <GlavnaKnjiga />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/bruto-bilans" element={
                <ProtectedRoute>
                  <BrutoBilans />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/kartica-konta/:code" element={
                <ProtectedRoute requireCompany={false}>
                  <KarticaKonta />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/kartice-partnera" element={
                <ProtectedRoute>
                  <KarticePartnera />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/ponude" element={
                <ProtectedRoute>
                  <Ponude />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/fakture" element={
                <ProtectedRoute>
                  <Fakture />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/otpremnice" element={
                <ProtectedRoute>
                  <Otpremnice />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/ulazne-fakture-usluge" element={
                <ProtectedRoute>
                  <UlazneFaktureUsluge />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/ulazne-fakture-roba" element={
                <ProtectedRoute>
                  <UlazneFaktureRoba />
                </ProtectedRoute>
              } />
              <Route path="/magacin/prijemnice" element={
                <ProtectedRoute>
                  <Prijemnice />
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
