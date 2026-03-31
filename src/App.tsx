import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { IdleTimeoutProvider } from "@/components/IdleTimeoutProvider";
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
import TekuciRacuni from "./pages/sifarnici/TekuciRacuni";
import AdminPanel from "./pages/admin/AdminPanel";
import KontniPlan from "./pages/racunovodstvo/KontniPlan";
import NaloziZaKnjizenje from "./pages/racunovodstvo/NaloziZaKnjizenje";
import JournalEntryEdit from "./pages/racunovodstvo/JournalEntryEdit";
import GlavnaKnjiga from "./pages/racunovodstvo/GlavnaKnjiga";
import BrutoBilans from "./pages/racunovodstvo/BrutoBilans";
import KarticaKonta from "./pages/racunovodstvo/KarticaKonta";
import KarticePartnera from "./pages/racunovodstvo/KarticePartnera";
import PartneriPoValuti from "./pages/racunovodstvo/PartneriPoValuti";
import PartneriPoDpo from "./pages/racunovodstvo/PartneriPoDpo";
import PartnerDocumentBalancesReport from "./pages/racunovodstvo/PartnerDocumentBalancesReport";
import Ponude from "./pages/prodaja/Ponude";
import QuoteEdit from "./pages/prodaja/QuoteEdit";
import Fakture from "./pages/prodaja/Fakture";
import InvoiceEdit from "./pages/prodaja/InvoiceEdit";
import Otpremnice from "./pages/prodaja/Otpremnice";
import DeliveryNoteEdit from "./pages/prodaja/DeliveryNoteEdit";
import NaloziZaIsporuku from "./pages/prodaja/NaloziZaIsporuku";
import DeliveryOrderEdit from "./pages/prodaja/DeliveryOrderEdit";
import UlazneFaktureUsluge from "./pages/nabavka/UlazneFaktureUsluge";
import ServicePurchaseInvoiceEdit from "./pages/nabavka/ServicePurchaseInvoiceEdit";
import UlazneFaktureRoba from "./pages/nabavka/UlazneFaktureRoba";
import GoodsPurchaseInvoiceEdit from "./pages/nabavka/GoodsPurchaseInvoiceEdit";
import UlazneFaktureAvansi from "./pages/nabavka/UlazneFaktureAvansi";
import AdvancePurchaseInvoiceEdit from "./pages/nabavka/AdvancePurchaseInvoiceEdit";
import PrimljenaKnjiznaOdobrenja from "./pages/nabavka/PrimljenaKnjiznaOdobrenja";
import ReceivedCreditNoteEdit from "./pages/nabavka/ReceivedCreditNoteEdit";
import NaloziZaPlacanja from "./pages/nabavka/NaloziZaPlacanja";
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
import Rezervacije from "./pages/magacin/Rezervacije";
import StanjeSaRezervacijama from "./pages/magacin/StanjeSaRezervacijama";
import Normativi from "./pages/proizvodnja/Normativi";
import NormativEdit from "./pages/proizvodnja/NormativEdit";
import RadniNalozi from "./pages/proizvodnja/RadniNalozi";
import WorkOrderEdit from "./pages/proizvodnja/WorkOrderEdit";
import Trebovanja from "./pages/proizvodnja/Trebovanja";
import RequisitionEdit from "./pages/proizvodnja/RequisitionEdit";
import PredajniceGP from "./pages/proizvodnja/PredajniceGP";
import ProductionDeliveryNoteEdit from "./pages/proizvodnja/ProductionDeliveryNoteEdit";
import ReprocessingWorkOrders from "./pages/proizvodnja/ReprocessingWorkOrders";
import ReprocessingWorkOrderEdit from "./pages/proizvodnja/ReprocessingWorkOrderEdit";
import ReprocessingDeliveryNotesList from "./pages/proizvodnja/ReprocessingDeliveryNotesList";
import ReprocessingDeliveryNoteEdit from "./pages/proizvodnja/ReprocessingDeliveryNoteEdit";
import AvansniRacuni from "./pages/prodaja/AvansniRacuni";
import AdvanceInvoiceEdit from "./pages/prodaja/AdvanceInvoiceEdit";
import KnjiznaOdobrenja from "./pages/prodaja/KnjiznaOdobrenja";
import CreditNoteEdit from "./pages/prodaja/CreditNoteEdit";
import PopdvList from "./pages/racunovodstvo/PopdvList";
import PopdvEdit from "./pages/racunovodstvo/PopdvEdit";
import PopdvAnalyticalEdit from "./pages/racunovodstvo/PopdvAnalyticalEdit";
import PopdvDocumentsReport from "./pages/racunovodstvo/PopdvDocumentsReport";
import PpPdvList from "./pages/racunovodstvo/PpPdvList";
import PpPdvEdit from "./pages/racunovodstvo/PpPdvEdit";
import SifarnikPlacanja from "./pages/racunovodstvo/SifarnikPlacanja";
import KursnaLista from "./pages/sifarnici/KursnaLista";
import Izvodi from "./pages/racunovodstvo/Izvodi";
import BankStatementEdit from "./pages/racunovodstvo/BankStatementEdit";
import AiAssistant from "./pages/AiAssistant";
import ZavodjenjePoste from "./pages/pisarnica/ZavodjenjePoste";
import IncomingMailEdit from "./pages/pisarnica/IncomingMailEdit";
import LikvidacijaPoste from "./pages/pisarnica/LikvidacijaPoste";
import ZavodjenjePoslatePoste from "./pages/pisarnica/ZavodjenjePoslatePoste";
import OutgoingMailEdit from "./pages/pisarnica/OutgoingMailEdit";
import Predmeti from "./pages/pisarnica/Predmeti";
import PredmetEdit from "./pages/pisarnica/PredmetEdit";
import Zaposleni from "./pages/zarade/Zaposleni";
import EmployeeEdit from "./pages/zarade/EmployeeEdit";
import Odsustva from "./pages/zarade/Odsustva";
import AbsenceEdit from "./pages/zarade/AbsenceEdit";
import KalendarOdsustva from "./pages/zarade/KalendarOdsustva";
import FondOdmora from "./pages/zarade/FondOdmora";
import ObracunZarada from "./pages/zarade/ObracunZarada";
import ObracunEdit from "./pages/zarade/ObracunEdit";
import ParametriObracuna from "./pages/zarade/ParametriObracuna";
import EvidencijaRadnogVremena from "./pages/zarade/EvidencijaRadnogVremena";
import Obustave from "./pages/zarade/Obustave";
import OsnovnaSredstva from "./pages/osnovna-sredstva/OsnovnaSredstva";
import FixedAssetEdit from "./pages/osnovna-sredstva/FixedAssetEdit";
import ObracunAmortizacije from "./pages/osnovna-sredstva/ObracunAmortizacije";
import GrupeOS from "./pages/osnovna-sredstva/GrupeOS";
import PopisnaListaOS from "./pages/osnovna-sredstva/PopisnaListaOS";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <IdleTimeoutProvider>
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
              <Route path="/sifarnici/tekuci-racuni" element={
                <ProtectedRoute>
                  <TekuciRacuni />
                </ProtectedRoute>
              } />
              <Route path="/ai-asistent" element={
                <ProtectedRoute requireAdmin>
                  <AiAssistant />
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
              <Route path="/racunovodstvo/partneri-valuta" element={
                <ProtectedRoute>
                  <PartneriPoValuti />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/partneri-dpo" element={
                <ProtectedRoute>
                  <PartneriPoDpo />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/dokumenti-partnera" element={
                <ProtectedRoute>
                  <PartnerDocumentBalancesReport />
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
              <Route path="/prodaja/nalozi-isporuka" element={
                <ProtectedRoute>
                  <NaloziZaIsporuku />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/nalozi-isporuka/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <DeliveryOrderEdit />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/otpremnice" element={
                <ProtectedRoute>
                  <Otpremnice />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/otpremnice/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <DeliveryNoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/avansni-racuni" element={
                <ProtectedRoute>
                  <AvansniRacuni />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/avansni-racuni/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <AdvanceInvoiceEdit />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/knjizna-odobrenja" element={
                <ProtectedRoute>
                  <KnjiznaOdobrenja />
                </ProtectedRoute>
              } />
              <Route path="/prodaja/knjizna-odobrenja/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <CreditNoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/popdv" element={
                <ProtectedRoute>
                  <PopdvList />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/popdv/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <PopdvEdit />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/popdv/:id/analytical" element={
                <ProtectedRoute requireCompany={false}>
                  <PopdvAnalyticalEdit />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/popdv/documents-report" element={
                <ProtectedRoute>
                  <PopdvDocumentsReport />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/pp-pdv" element={
                <ProtectedRoute>
                  <PpPdvList />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/pp-pdv/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <PpPdvEdit />
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
              <Route path="/nabavka/ulazne-fakture-avansi" element={
                <ProtectedRoute>
                  <UlazneFaktureAvansi />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/ulazne-fakture-avansi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <AdvancePurchaseInvoiceEdit />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/primljena-ko" element={
                <ProtectedRoute>
                  <PrimljenaKnjiznaOdobrenja />
                </ProtectedRoute>
              } />
              <Route path="/nabavka/primljena-ko/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ReceivedCreditNoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/nalozi-placanja" element={
                <ProtectedRoute>
                  <NaloziZaPlacanja />
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
              <Route path="/magacin/rezervacije" element={
                <ProtectedRoute>
                  <Rezervacije />
                </ProtectedRoute>
              } />
              <Route path="/magacin/stanje-rezervacije" element={
                <ProtectedRoute>
                  <StanjeSaRezervacijama />
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
              <Route path="/proizvodnja/predajnice" element={
                <ProtectedRoute>
                  <PredajniceGP />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/predajnice/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ProductionDeliveryNoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/prerada" element={
                <ProtectedRoute>
                  <ReprocessingWorkOrders />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/prerada/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ReprocessingWorkOrderEdit />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/predajnice-prerada" element={
                <ProtectedRoute>
                  <ReprocessingDeliveryNotesList />
                </ProtectedRoute>
              } />
              <Route path="/proizvodnja/predajnice-prerada/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ReprocessingDeliveryNoteEdit />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/sifarnik-placanja" element={
                <ProtectedRoute>
                  <SifarnikPlacanja />
                </ProtectedRoute>
              } />
              <Route path="/sifarnici/kursna-lista" element={
                <ProtectedRoute>
                  <KursnaLista />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/izvodi" element={
                <ProtectedRoute>
                  <Izvodi />
                </ProtectedRoute>
              } />
              <Route path="/racunovodstvo/izvodi/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <BankStatementEdit />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/zavodjenje" element={
                <ProtectedRoute>
                  <ZavodjenjePoste />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/zavodjenje/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <IncomingMailEdit />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/likvidacija" element={
                <ProtectedRoute>
                  <LikvidacijaPoste />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/poslata-posta" element={
                <ProtectedRoute>
                  <ZavodjenjePoslatePoste />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/poslata-posta/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <OutgoingMailEdit />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/predmeti" element={
                <ProtectedRoute>
                  <Predmeti />
                </ProtectedRoute>
              } />
              <Route path="/pisarnica/predmeti/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <PredmetEdit />
                </ProtectedRoute>
              } />
              <Route path="/zarade/zaposleni" element={
                <ProtectedRoute>
                  <Zaposleni />
                </ProtectedRoute>
              } />
              <Route path="/zarade/zaposleni/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <EmployeeEdit />
                </ProtectedRoute>
              } />
              <Route path="/zarade/odsustva" element={
                <ProtectedRoute>
                  <Odsustva />
                </ProtectedRoute>
              } />
              <Route path="/zarade/odsustva/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <AbsenceEdit />
                </ProtectedRoute>
              } />
              <Route path="/zarade/kalendar" element={
                <ProtectedRoute>
                  <KalendarOdsustva />
                </ProtectedRoute>
              } />
              <Route path="/zarade/fond-odmora" element={
                <ProtectedRoute>
                  <FondOdmora />
                </ProtectedRoute>
              } />
              <Route path="/zarade/obracun" element={
                <ProtectedRoute>
                  <ObracunZarada />
                </ProtectedRoute>
              } />
              <Route path="/zarade/obracun/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <ObracunEdit />
                </ProtectedRoute>
              } />
              <Route path="/zarade/parametri" element={
                <ProtectedRoute>
                  <ParametriObracuna />
                </ProtectedRoute>
              } />
              <Route path="/zarade/evidencija-sati" element={
                <ProtectedRoute>
                  <EvidencijaRadnogVremena />
                </ProtectedRoute>
              } />
              <Route path="/zarade/obustave" element={
                <ProtectedRoute>
                  <Obustave />
                </ProtectedRoute>
              } />
              <Route path="/osnovna-sredstva/kartoni" element={
                <ProtectedRoute>
                  <OsnovnaSredstva />
                </ProtectedRoute>
              } />
              <Route path="/osnovna-sredstva/kartoni/:id" element={
                <ProtectedRoute requireCompany={false}>
                  <FixedAssetEdit />
                </ProtectedRoute>
              } />
              <Route path="/osnovna-sredstva/grupe" element={
                <ProtectedRoute>
                  <GrupeOS />
                </ProtectedRoute>
              } />
              <Route path="/osnovna-sredstva/amortizacija" element={
                <ProtectedRoute>
                  <ObracunAmortizacije />
                </ProtectedRoute>
              } />
              <Route path="/osnovna-sredstva/popis" element={
                <ProtectedRoute>
                  <PopisnaListaOS />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </IdleTimeoutProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
