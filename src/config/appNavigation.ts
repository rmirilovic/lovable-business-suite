import type { ElementType } from "react";
import {
  Bot,
  Factory,
  FileText,
  Landmark,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
  Briefcase,
} from "lucide-react";

export interface NavigationChild {
  label: string;
  href: string;
  moduleCode?: string;
}

export interface NavigationItem {
  label: string;
  icon: ElementType;
  href?: string;
  moduleCode?: string;
  children?: NavigationChild[];
}

export const appNavigation: NavigationItem[] = [
  { label: "Kontrolna tabla", icon: LayoutDashboard, href: "/" },
  {
    label: "Šifarnici",
    icon: Package,
    moduleCode: "sifarnici",
    children: [
      { label: "Artikli", href: "/sifarnici/artikli", moduleCode: "sifarnici.artikli" },
      { label: "Klasifikacija artikala", href: "/sifarnici/grupe", moduleCode: "sifarnici.klasifikacije" },
      { label: "Atributi artikala", href: "/sifarnici/atributi", moduleCode: "sifarnici.atributi" },
      { label: "Varijante artikala", href: "/sifarnici/varijante", moduleCode: "sifarnici.atributi" },
      { label: "Povezivanje sa varijantama", href: "/sifarnici/povezivanje-varijanti", moduleCode: "sifarnici.atributi" },
      { label: "Magacini", href: "/sifarnici/magacini", moduleCode: "sifarnici.magacini" },
      { label: "Organizacione jedinice", href: "/sifarnici/org-jedinice", moduleCode: "sifarnici.org_jedinice" },
      { label: "Kontni plan", href: "/sifarnici/kontni-plan", moduleCode: "racunovodstvo.kontni_plan" },
      { label: "Ulazni troškovi", href: "/sifarnici/ulazni-troskovi", moduleCode: "sifarnici.ulazni_troskovi" },
      { label: "Šefovi smena", href: "/sifarnici/sefovi-smena", moduleCode: "sifarnici.ulazni_troskovi" },
      { label: "Tekući računi", href: "/sifarnici/tekuci-racuni", moduleCode: "sifarnici.magacini" },
      { label: "Šifarnik plaćanja", href: "/sifarnici/sifarnik-placanja", moduleCode: "racunovodstvo.nalozi" },
      { label: "Kursna lista NBS", href: "/sifarnici/kursna-lista", moduleCode: "racunovodstvo.nalozi" },
    ],
  },
  {
    label: "Pisarnica",
    icon: Mail,
    moduleCode: "pisarnica",
    children: [
      { label: "Zavođenje ulazne pošte", href: "/pisarnica/zavodjenje", moduleCode: "pisarnica.zavodjenje" },
      { label: "Likvidacija dokumenta", href: "/pisarnica/likvidacija", moduleCode: "pisarnica.likvidacija" },
      { label: "Zavođenje poslate pošte", href: "/pisarnica/poslata-posta", moduleCode: "pisarnica.poslata_posta" },
      { label: "Predmeti (CRM)", href: "/pisarnica/predmeti", moduleCode: "pisarnica.predmeti" },
    ],
  },
  {
    label: "Prodaja",
    icon: ShoppingCart,
    moduleCode: "prodaja",
    children: [
      { label: "Ponude", href: "/prodaja/ponude", moduleCode: "prodaja.ponude" },
      { label: "Nalozi za isporuku", href: "/prodaja/nalozi-isporuka", moduleCode: "prodaja.otpremnice" },
      { label: "Fakture", href: "/prodaja/fakture", moduleCode: "prodaja.fakture" },
      { label: "Fakture za avans", href: "/prodaja/avansni-racuni", moduleCode: "prodaja.fakture" },
      { label: "Knjižna odobrenja", href: "/prodaja/knjizna-odobrenja", moduleCode: "prodaja.fakture" },
    ],
  },
  {
    label: "Nabavka",
    icon: FileText,
    moduleCode: "nabavka",
    children: [
      { label: "UF za usluge", href: "/nabavka/ulazne-fakture-usluge", moduleCode: "nabavka.ulazne_fakture" },
      { label: "UF za robu", href: "/nabavka/ulazne-fakture-roba", moduleCode: "nabavka.ulazne_fakture" },
      { label: "UF za avanse", href: "/nabavka/ulazne-fakture-avansi", moduleCode: "nabavka.ulazne_fakture" },
      { label: "Primljena KO", href: "/nabavka/primljena-ko", moduleCode: "nabavka.ulazne_fakture" },
      { label: "Carinski obračun", href: "/nabavka/carinski-obracun", moduleCode: "nabavka.ulazne_fakture" },
      { label: "Kalkulacije", href: "/magacin/kalkulacije", moduleCode: "robno.prijemnice" },
      { label: "Narudžbenice", href: "/nabavka/narudzbenice", moduleCode: "nabavka.porudzbine" },
    ],
  },
  {
    label: "Partneri",
    icon: Users,
    moduleCode: "sifarnici.partneri",
    children: [
      { label: "Šifarnik partnera", href: "/sifarnici/partneri", moduleCode: "sifarnici.partneri" },
      { label: "Kartice partnera", href: "/racunovodstvo/kartice-partnera", moduleCode: "racunovodstvo.kartice_partnera" },
      { label: "Partneri po datumu valute", href: "/racunovodstvo/partneri-valuta", moduleCode: "racunovodstvo.kartice_partnera" },
      { label: "Partneri po datumu DPO", href: "/racunovodstvo/partneri-dpo", moduleCode: "racunovodstvo.kartice_partnera" },
      { label: "Dokumenti partnera", href: "/racunovodstvo/dokumenti-partnera", moduleCode: "racunovodstvo.kartice_partnera" },
    ],
  },
  {
    label: "Magacin",
    icon: Warehouse,
    moduleCode: "robno",
    children: [
      { label: "Prijemnice", href: "/magacin/prijemnice", moduleCode: "robno.prijemnice" },
      { label: "Otpremnice", href: "/prodaja/otpremnice", moduleCode: "prodaja.otpremnice" },
      { label: "Nivelacije", href: "/magacin/nivelacije", moduleCode: "robno.prijemnice" },
      { label: "Međumagacinski prenosi", href: "/magacin/prenosi", moduleCode: "robno.prijemnice" },
      { label: "Zamena artikla", href: "/magacin/zamene", moduleCode: "robno.prijemnice" },
      { label: "Zamena varijante", href: "/magacin/zamene-varijanti", moduleCode: "robno.prijemnice" },
      { label: "Popisi", href: "/magacin/popisi", moduleCode: "robno.prijemnice" },
      { label: "Stanje magacina", href: "/magacin/stanje", moduleCode: "robno.prijemnice" },
      { label: "Stanje po varijantama", href: "/magacin/stanje-varijante", moduleCode: "robno.prijemnice" },
      { label: "Stanje sa rezervacijama", href: "/magacin/stanje-rezervacije", moduleCode: "robno.prijemnice" },
      { label: "Rezervacije", href: "/magacin/rezervacije", moduleCode: "robno.prijemnice" },
      { label: "Lager lista", href: "/magacin/lager-lista", moduleCode: "robno.prijemnice" },
      { label: "R.K. u svim magacinima", href: "/magacin/rk-svi-magacini", moduleCode: "robno.prijemnice" },
      { label: "Promet magacina", href: "/magacin/promet", moduleCode: "robno.prijemnice" },
    ],
  },
  {
    label: "Proizvodnja",
    icon: Factory,
    moduleCode: "proizvodnja",
    children: [
      { label: "Normativi", href: "/proizvodnja/normativi", moduleCode: "proizvodnja.sastavnice" },
      { label: "Radni nalozi", href: "/proizvodnja/nalozi", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Trebovanja", href: "/proizvodnja/trebovanja", moduleCode: "proizvodnja.trebovanja" },
      { label: "Predajnice GP", href: "/proizvodnja/predajnice", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "RN za preradu", href: "/proizvodnja/prerada", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Predajnice preradu", href: "/proizvodnja/predajnice-prerada", moduleCode: "proizvodnja.radni_nalozi" },
      { label: "Recepture", href: "/proizvodnja/recepture", moduleCode: "proizvodnja.sastavnice" },
    ],
  },
  {
    label: "Računovodstvo",
    icon: FileText,
    moduleCode: "racunovodstvo",
    children: [
      { label: "Nalozi za knjiženje", href: "/racunovodstvo/nalozi", moduleCode: "racunovodstvo.nalozi" },
      { label: "Izvodi", href: "/racunovodstvo/izvodi", moduleCode: "racunovodstvo.nalozi" },
      { label: "Nalozi za plaćanja", href: "/racunovodstvo/nalozi-placanja", moduleCode: "racunovodstvo.nalozi_placanja" },
      { label: "Glavna knjiga", href: "/racunovodstvo/glavna-knjiga", moduleCode: "racunovodstvo.glavna_knjiga" },
      { label: "Bruto bilans", href: "/racunovodstvo/bruto-bilans", moduleCode: "racunovodstvo.bruto_bilans" },
      { label: "POPDV", href: "/racunovodstvo/popdv", moduleCode: "racunovodstvo.nalozi" },
      { label: "PP-PDV Prijava", href: "/racunovodstvo/pp-pdv", moduleCode: "racunovodstvo.nalozi" },
      { label: "Stanje po TR", href: "/racunovodstvo/stanje-po-tr", moduleCode: "racunovodstvo.glavna_knjiga" },
      { label: "Bilans uspeha", href: "/racunovodstvo/bilans-uspeha", moduleCode: "racunovodstvo.bruto_bilans" },
    ],
  },
  {
    label: "Osnovna sredstva",
    icon: Landmark,
    moduleCode: "osnovna_sredstva",
    children: [
      { label: "Kartoni OS", href: "/osnovna-sredstva/kartoni", moduleCode: "osnovna_sredstva.kartoni" },
      { label: "Amortizacione grupe", href: "/osnovna-sredstva/grupe", moduleCode: "osnovna_sredstva.grupe" },
      { label: "Obračun amortizacije", href: "/osnovna-sredstva/amortizacija", moduleCode: "osnovna_sredstva.amortizacija" },
      { label: "Popisna lista OS", href: "/osnovna-sredstva/popis", moduleCode: "osnovna_sredstva.popis" },
    ],
  },
  {
    label: "Zarade",
    icon: Briefcase,
    moduleCode: "zarade",
    children: [
      { label: "Zaposleni", href: "/zarade/zaposleni", moduleCode: "zarade.zaposleni" },
      { label: "Evidencija radnog vremena", href: "/zarade/evidencija-sati", moduleCode: "zarade.evidencija_sati" },
      { label: "Obračun zarada", href: "/zarade/obracun", moduleCode: "zarade.obracun" },
      { label: "Obustave od zarada", href: "/zarade/obustave", moduleCode: "zarade.obracun" },
      { label: "Parametri obračuna", href: "/zarade/parametri", moduleCode: "zarade.obracun" },
      { label: "Evidencija odsustva", href: "/zarade/odsustva", moduleCode: "zarade.odsustva" },
      { label: "Kalendar odsustva", href: "/zarade/kalendar", moduleCode: "zarade.kalendar" },
      { label: "Fond godišnjeg odmora", href: "/zarade/fond-odmora", moduleCode: "zarade.fond_odmora" },
    ],
  },
  { label: "AI Asistent", icon: Bot, href: "/ai-asistent", moduleCode: "administracija" },
  { label: "Administracija", icon: Settings, href: "/admin", moduleCode: "administracija" },
];
