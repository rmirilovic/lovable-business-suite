# Articles API Dokumentacija

API za izvoz i uvoz artikala sa atributima.

## Base URL

```
https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api
```

## Autentifikacija

Svi zahtevi moraju sadržati JWT token u `Authorization` headeru:

```
Authorization: Bearer <your_jwt_token>
```

Token se dobija nakon uspešne prijave korisnika kroz Supabase Auth.

---

## Endpoints

### 1. Izvoz artikala (GET)

Vraća sve artikle za određenu firmu i poslovnu godinu, zajedno sa njihovim atributima.

#### Request

```http
GET /articles-api?company_id=<uuid>&business_year_id=<uuid>
Authorization: Bearer <token>
```

#### Query parametri

| Parametar          | Tip    | Obavezan | Opis                          |
|--------------------|--------|----------|-------------------------------|
| `company_id`       | UUID   | Da       | ID firme za izvoz             |
| `business_year_id` | UUID   | Da       | ID poslovne godine za izvoz   |

#### Response (200 OK)

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "code": "001",
      "name": "Primer Artikal",
      "article_group": "01",
      "unit": "kom",
      "purchase_price": 100.00,
      "selling_price": 150.00,
      "stock": 50,
      "min_stock": 10,
      "is_active": true,
      "svk": "0",
      "kg_po_jm": 0.5,
      "kol_mas": null,
      "attributes": [
        {
          "attribute_code": "BOJA",
          "value": "Crvena"
        },
        {
          "attribute_code": "VELICINA",
          "value": "XL"
        }
      ]
    }
  ]
}
```

---

### 2. Uvoz artikala (POST)

Uvozi artikle sa atributima. Može kreirati nove ili ažurirati postojeće.

#### Request

```http
POST /articles-api?company_id=<uuid>&business_year_id=<uuid>
Authorization: Bearer <token>
Content-Type: application/json
```

#### Query parametri

| Parametar          | Tip    | Obavezan | Opis                          |
|--------------------|--------|----------|-------------------------------|
| `company_id`       | UUID   | Da       | ID firme za uvoz              |
| `business_year_id` | UUID   | Da       | ID poslovne godine za uvoz    |

#### Body parametri

| Polje             | Tip      | Obavezan | Opis                                              |
|-------------------|----------|----------|---------------------------------------------------|
| `data`            | Array    | Da       | Niz artikala za uvoz                              |
| `update_existing` | Boolean  | Ne       | Ako je `true`, ažurira postojeće artikle po šifri (default: `false`) |

#### Primer request body

```json
{
  "update_existing": true,
  "data": [
    {
      "code": "001",
      "name": "Primer Artikal",
      "article_group": "01",
      "unit": "kom",
      "purchase_price": 100.00,
      "selling_price": 150.00,
      "stock": 50,
      "min_stock": 10,
      "is_active": true,
      "svk": "0",
      "kg_po_jm": 0.5,
      "kol_mas": null,
      "attributes": [
        {
          "attribute_code": "BOJA",
          "value": "Crvena"
        }
      ]
    }
  ]
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "imported": 5,
  "updated": 2,
  "skipped": 1,
  "errors": [
    {
      "code": "ERR001",
      "error": "duplicate key value violates unique constraint"
    }
  ]
}
```

---

## Struktura podataka

### Artikal objekat

| Polje            | Tip      | Obavezan | Opis                                                    |
|------------------|----------|----------|---------------------------------------------------------|
| `code`           | String   | Da       | Jedinstvena šifra artikla                               |
| `name`           | String   | Da       | Naziv artikla                                           |
| `article_group`  | String   | Ne       | Šifra klasifikacije/grupe artikla                       |
| `unit`           | String   | Ne       | Jedinica mere (default: "kom")                          |
| `purchase_price` | Number   | Ne       | Nabavna cena (default: 0)                               |
| `selling_price`  | Number   | Ne       | Prodajna cena (default: 0)                              |
| `stock`          | Number   | Ne       | Trenutna količina na lageru (default: 0)                |
| `min_stock`      | Number   | Ne       | Minimalna količina za alarm (default: 0)                |
| `is_active`      | Boolean  | Ne       | Da li je aktivan (default: true)                        |
| `svk`            | String   | Ne       | SVK tip: "0", "1", "2", "6", "8", "9" (null = nije definisano) |
| `kg_po_jm`       | Number   | Ne       | Kilograma po jedinici mere                              |
| `kol_mas`        | Number   | Ne       | Količina mase                                           |
| `attributes`     | Array    | Ne       | Niz atributa artikla                                    |

### SVK tipovi

| Vrednost | Opis                    |
|----------|-------------------------|
| `0`      | Roba                    |
| `1`      | Proizvod                |
| `2`      | Usluga                  |
| `6`      | Prevozna usluga         |
| `8`      | Vraćena roba (refakcija)|
| `9`      | Ostalo                  |

### Atribut objekat

| Polje            | Tip    | Obavezan | Opis                                    |
|------------------|--------|----------|-----------------------------------------|
| `attribute_code` | String | Da       | Šifra atributa (mora postojati u bazi)  |
| `value`          | String | Da       | Vrednost atributa                       |

---

## Greške

| Status | Opis                                          |
|--------|-----------------------------------------------|
| 400    | Neispravan zahtev (nedostaje company_id ili business_year_id, loš format) |
| 401    | Nedostaje ili nevažeći token                  |
| 403    | Pristup odbijen (nema pristup firmi ili nije admin za uvoz) |
| 405    | Metoda nije dozvoljena                        |
| 500    | Interna greška servera                        |

### Primer greške

```json
{
  "error": "Access denied to this company"
}
```

---

## Primeri korišćenja

### cURL - Izvoz

```bash
curl -X GET \
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=<uuid>&business_year_id=<uuid>" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### cURL - Uvoz

```bash
curl -X POST \
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=<uuid>&business_year_id=<uuid>" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "update_existing": false,
    "data": [
      {
        "code": "TEST001",
        "name": "Test Artikal",
        "unit": "kom"
      }
    ]
  }'
```

### JavaScript/TypeScript

```typescript
import { supabase } from "@/integrations/supabase/client";

// Izvoz artikala
async function exportArticles(companyId: string, businessYearId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${companyId}&business_year_id=${businessYearId}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    }
  );
  
  return res.json();
}

// Uvoz artikala
async function importArticles(companyId: string, businessYearId: string, articles: any[], updateExisting = false) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${companyId}&business_year_id=${businessYearId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: articles,
        update_existing: updateExisting,
      }),
    }
  );
  
  return res.json();
}
```

---

## Napomene

1. **Atributi artikala** - `attribute_code` mora odgovarati postojećoj šifri atributa u bazi za datu firmu. Ako atribut ne postoji, taj par atribut-vrednost se preskače.

2. **Atributi pri ažuriranju** - Kada se ažurira postojeći artikal (`update_existing: true`), svi postojeći atributi se brišu i zamenjuju novim iz zahteva.

3. **Minimalni podaci za uvoz** - Jedini obavezni podaci su `code` i `name`. Svi ostali imaju default vrednosti.

4. **Ograničenje pristupa** - Za izvoz je potreban pristup firmi (bilo koji korisnik sa pristupom). Za uvoz je potrebna admin uloga (super_admin ili local_admin za tu firmu).

5. **Poslovna godina** - Artikli su vezani za poslovnu godinu. Pri izvozu/uvozu morate navesti ID poslovne godine.

6. **Batch procesiranje** - API koristi batch upite za velike setove podataka (1000 artikala po batch-u za osnovne podatke, 100 ID-ova po batch-u za .in() upite) kako bi se izbegla ograničenja URL dužine.
