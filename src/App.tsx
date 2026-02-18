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
import SefoviSmena from "./pages/sifarnici/SefoviSmena";
import AdminPanel from "./pages/admin/AdminPanel";
import KontniPlan from "./pages/racunovodstvo/KontniPlan";
import NaloziZaKnjizenje from "./pages/racunovodstvo/NaloziZaKnjizenje";
import JournalEntryEdit from "./pages/racunovodstvo/JournalEntryEdit";
import GlavnaKnjiga from "./pages/racunovodstvo/GlavnaKnjiga";
import BrutoBilans from "./pages/racunovodstvo/BrutoBilans";
import KarticaKonta from "./pages/racunovodstvo/KarticaKonta";
import KarticePartnera from "./pages/racunovodstvo/KarticePartnera";
import Ponude from "./pages/prodaja/Ponude";
import QuoteEdit from "./pages/prodaja/QuoteEdit";
import Fakture from "./pages/prodaja/Fakture";
import InvoiceEdit from "./pages/prodaja/InvoiceEdit";
import Otpremnice from "./pages/prodaja/Otpremnice";
import UlazneFaktureUsluge from "./pages/nabavka/UlazneFaktureUsluge";
import ServicePurchaseInvoiceEdit from "./pages/nabavka/ServicePurchaseInvoiceEdit";
import UlazneFaktureRoba from "./pages/nabavka/UlazneFaktureRoba";
import GoodsPurchaseInvoiceEdit from "./pages/nabavka/GoodsPurchaseInvoiceEdit";
import Prijemnice from "./pages/magacin/Prijemnice";
import GoodsReceiptEdit from "./pages/magacin/GoodsReceiptEdit";
import Kalkulacije from "./pages/magacin/Kalkulacije";
import CalculationEdit from "./pages/magacin/CalculationEdit";
import StanjeMagacina from "./pages/magacin/StanjeMagacina";
import Popisi from "./pages/magacin/Popisi";
import InventoryCountEdit from "./pages/magacin/InventoryCountEdit";
import Nivelacije from "./pages/magacin/Nivelacije";
import PriceAdjustmentEdit from "./pages/magacin/PriceAdjustmentEdit";
import MedjumagacinskiPrenosi from "./pages/magacin/MedjumagacinskiPrenosi";
import TransferEdit from "./pages/magacin/TransferEdit";
import ZameneArtikala from "./pages/magacin/ZameneArtikala";
import ArticleSwapEdit from "./pages/magacin/ArticleSwapEdit";
import PrometMagacina from "./pages/magacin/PrometMagacina";
import LagerLista from "./pages/magacin/LagerLista";
import Normativi from "./pages/proizvodnja/Normativi";
import NormativEdit from "./pages/proizvodnja/NormativEdit";
import RadniNalozi from "./pages/proizvodnja/RadniNalozi";
import WorkOrderEdit from "./pages/proizvodnja/WorkOrderEdit";
import Trebovanja from "./pages/proizvodnja/Trebovanja";
import RequisitionEdit from "./pages/proizvodnja/RequisitionEdit";
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
              <Route path="/sifarnici/sefovi-smena" element={
                <ProtectedRoute>
                  <SefoviSmena />
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
              <Route path="/racunovodstvo/nalozi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <JournalEntryEdit />
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
              <Route path="/prodaja/ponude/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <QuoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/fakture" element={
                <ProtectedRoute>
                  <Fakture />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/fakture/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <InvoiceEdit />
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
              <Route path="/nabavka/ulazne-fakture-usluge/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ServicePurchaseInvoiceEdit />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/ulazne-fakture-roba" element={
                <ProtectedRoute>
                  <UlazneFaktureRoba />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/ulazne-fakture-roba/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <GoodsPurchaseInvoiceEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/prijemnice" element={
                <ProtectedRoute>
                  <Prijemnice />
                </ProtectedRoute>
              } />
              <Route path="/magacin/prijemnice/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <GoodsReceiptEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/kalkulacije" element={
                <ProtectedRoute>
                  <Kalkulacije />
                </ProtectedRoute>
              } />
              <Route path="/magacin/kalkulacije/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <CalculationEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/stanje" element={
                <ProtectedRoute>
                  <StanjeMagacina />
                </ProtectedRoute>
              } />
              <Route path="/magacin/popisi" element={
                <ProtectedRoute>
                  <Popisi />
                </ProtectedRoute>
              } />
              <Route path="/magacin/popisi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <InventoryCountEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/nivelacije" element={
                <ProtectedRoute>
                  <Nivelacije />
                </ProtectedRoute>
              } />
              <Route path="/magacin/nivelacije/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <PriceAdjustmentEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/prenosi" element={
                <ProtectedRoute>
                  <MedjumagacinskiPrenosi />
                </ProtectedRoute>
              } />
              <Route path="/magacin/prenosi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <TransferEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/zamene" element={
                <ProtectedRoute>
                  <ZameneArtikala />
                </ProtectedRoute>
              } />
              <Route path="/magacin/zamene/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ArticleSwapEdit />
                </ProtectedRoute>
              } />
              <Route path="/magacin/promet" element={
                <ProtectedRoute>
                  <PrometMagacina />
                </ProtectedRoute>
              } />
              <Route path="/magacin/lager-lista" element={
                <ProtectedRoute>
                  <LagerLista />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/normativi" element={
                <ProtectedRoute>
                  <Normativi />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/normativi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <NormativEdit />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/nalozi" element={
                <ProtectedRoute>
                  <RadniNalozi />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/nalozi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <WorkOrderEdit />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/trebovanja" element={
                <ProtectedRoute>
                  <Trebovanja />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/trebovanja/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <RequisitionEdit />
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
