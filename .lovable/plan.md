## Cilj

Omogućiti izradu izlaznih faktura za inostrane kupce (partneri sa `legal_status = 4` — "Ino partner") u skladu sa propisima u Srbiji: faktura u stranoj valuti, automatsko oslobođenje od PDV-a (član 24. ZPDV za izvoz robe, član 12. za usluge), evidencija JCI, knjiženje u RSD po srednjem kursu NBS, i mapiranje u POPDV.

Postojeća osnova već pokriva: izbor valute na fakturi (`currency`), `tax_category_code` + `tax_exemption_reason`, `partner_country_code`, `mesto_prometa`, snapshot polja kupca. Treba dograditi automatizam, kurs i RSD ekvivalente, JCI, knjiženje i izveštaje.

## Predlog implementacije po fazama

### Faza 1 — Osnova ino fakture (UI + podaci)

1. **Auto-podešavanja kada se izabere Ino partner** u `InvoiceHeaderDialog`:
   - `currency` se predlaže iz partnera (novo polje `default_currency` na partneru, default EUR), umesto RSD
   - `partner_country_code` se popunjava iz partnera (novo polje `country_code`, ISO-2)
   - `tax_category_code` = `E` (oslobođeno sa pravom na odbitak) za robu, sa preporučenim razlogom "Član 24. stav 1. tačka 2) ZPDV — izvoz dobara"
   - `payment_means_code` = `42` (međunarodni transfer)
   - Polja JCI vidljiva samo za ino partnera

2. **Nova polja na fakturi** (`invoices` tabela):
   - `jci_number` (text) — broj JCI/MRN
   - `jci_date` (date) — datum carinjenja
   - `exchange_rate` (numeric 18,6) — srednji kurs NBS na datum prometa
   - `subtotal_rsd`, `vat_amount_rsd`, `total_amount_rsd` — RSD ekvivalenti
   - `delivery_terms` (Incoterms, npr. EXW/FCA/CIP) — opciono

3. **Polja na partneru** (`partners`):
   - `country_code` (text, ISO-2, default 'RS')
   - `default_currency` (text, default 'RSD')
   - prikaz u `PartnerForm` u sekciji za pravna lica, vidljivo kad je legal_status = 4

4. **Kurs**: dugme "Učitaj kurs NBS" u zaglavlju koje iz postojeće `kursna_lista` (NBS srednji) povlači kurs za `datum_prometa` i izračunava RSD ekvivalente. Ručna izmena dozvoljena dok je dokument u draftu.

5. **Numeracija**: opciono poseban niz `IF-YYNNNN` za ino fakture (jer se ne šalju na SEF), ili nastavak postojeće numeracije sa oznakom u zaglavlju — preferiramo isti niz zbog jednostavnosti.

### Faza 2 — Knjiženje i izveštaji

6. **Posting** (`post_invoice` workflow): za fakture sa `currency != RSD`:
   - knjiženje u RSD po `exchange_rate`
   - 2040 (potraživanja od kupca, devizno analitičko konto, vodi se i original. iznos) / 6010 (roba) ili 6140 (usluge)
   - bez PDV-a (470 se ne tereti)
   - na `journal_entries` upisivati i original. iznos + valutu u napomeni; analitika partnera u deviznoj kartici

7. **POPDV mapiranje**:
   - Izvoz robe (kategorija E + Član 24) → polje **1.4**
   - Promet usluga van Srbije sa pravom na odbitak (Član 12) → polje **8a.1**
   - Verifikovati u `popdv_form` generatoru

8. **PDF na engleskom** (dvojezičan): naslov "INVOICE / FAKTURA", tabela kolona dvojezično, kupac, JCI, kurs i RSD ekvivalent prikazani u podnožju, oslobođenje od PDV na engleskom ("VAT exempt under Article 24 of the Serbian VAT Law").

### Faza 3 (kasnije, ne sada)

- Devizna kartica partnera i otvorene stavke u devizi
- Revalorizacija deviznih potraživanja na 31.12. (kursne razlike 564/664)
- Plaćanje sa deviznog računa + obračun realiz. kursnih razlika

## Tehnički detalji

**Tabele**: `partners` (+2 kolone), `invoices` (+5 kolona). Migracije sa default vrednostima da postojeći podaci ne pucaju.

**Hookovi**: `useInvoices` proširiti tipovima; novi util `useNbsRate(date, currency)`.

**Komponente**: `InvoiceHeaderDialog` (auto-defaults + JCI + kurs sekcija), `PartnerForm` (country_code + default_currency), `invoicePdfGenerator` (varijanta `generateForeignInvoicePdf`).

**Knjiženje**: postojeća `post_invoice` RPC funkcija proširiti da uzima `exchange_rate` i piše RSD iznose u `journal_entries`.

## Predlog redosleda i pitanje

Predlažem da krenemo sa **Fazom 1** (UI/podaci/auto-defaults + kurs + JCI) u jednom paketu, pa onda Fazu 2 (knjiženje + POPDV + PDF EN) u sledećem.

Da li da krenem sa kompletnom Fazom 1, ili želiš drugačiji obim/prioritet (npr. da odmah uključim i knjiženje, ili da preskočimo poseban PDF na engleskom)?