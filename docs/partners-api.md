# Partners API Dokumentacija

API za izvoz i uvoz partnera sa tekućim računima i kontakt osobama.

## Base URL

```
https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/partners-api
```

## Autentifikacija

Svi zahtevi moraju sadržati JWT token u `Authorization` headeru:

```
Authorization: Bearer <your_jwt_token>
```

Token se dobija nakon uspešne prijave korisnika kroz Supabase Auth.

---

## Endpoints

### 1. Izvoz partnera (GET)

Vraća sve partnere za određenu firmu, zajedno sa njihovim tekućim računima i kontakt osobama.

#### Request

```http
GET /partners-api?company_id=<uuid>
Authorization: Bearer <token>
```

#### Query parametri

| Parametar    | Tip    | Obavezan | Opis                    |
|--------------|--------|----------|-------------------------|
| `company_id` | UUID   | Da       | ID firme za izvoz       |

#### Response (200 OK)

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "code": "001",
      "name": "Primer Partner DOO",
      "legal_status": 1,
      "address": "Ulica 123",
      "postal_code": "11000",
      "city": "Beograd",
      "country": "Srbija",
      "email": "kontakt@primer.rs",
      "pib": "123456789",
      "mb": "12345678",
      "activity_code": "4791",
      "jbkjs": null,
      "website": "https://primer.rs",
      "responsible_person": "Petar Petrović",
      "phone": "+381111234567",
      "is_customer": true,
      "is_supplier": false,
      "is_in_pdv": true,
      "assigned_to": "Marko Marković",
      "note": "Napomena o partneru",
      "other_data": null,
      "is_active": true,
      "payment_priority": 1,
      "group_code": "GRUPA01",
      "bank_accounts": [
        {
          "account_number": "160-123456-78",
          "sort_order": 0
        },
        {
          "account_number": "265-987654-32",
          "sort_order": 1
        }
      ],
      "contacts": [
        {
          "contact_name": "Ana Anić",
          "position": "Direktor",
          "phone1": "+381641234567",
          "phone2": "+381651234567",
          "email": "ana@primer.rs",
          "note": "Glavna kontakt osoba"
        }
      ]
    }
  ]
}
```

---

### 2. Uvoz partnera (POST)

Uvozi partnere sa tekućim računima i kontakt osobama. Može kreirati nove ili ažurirati postojeće.

#### Request

```http
POST /partners-api?company_id=<uuid>
Authorization: Bearer <token>
Content-Type: application/json
```

#### Query parametri

| Parametar    | Tip    | Obavezan | Opis                    |
|--------------|--------|----------|-------------------------|
| `company_id` | UUID   | Da       | ID firme za uvoz        |

#### Body parametri

| Polje             | Tip      | Obavezan | Opis                                              |
|-------------------|----------|----------|---------------------------------------------------|
| `data`            | Array    | Da       | Niz partnera za uvoz                              |
| `update_existing` | Boolean  | Ne       | Ako je `true`, ažurira postojeće partnere po šifri (default: `false`) |

#### Primer request body

```json
{
  "update_existing": true,
  "data": [
    {
      "code": "001",
      "name": "Primer Partner DOO",
      "legal_status": 1,
      "address": "Ulica 123",
      "postal_code": "11000",
      "city": "Beograd",
      "country": "Srbija",
      "email": "kontakt@primer.rs",
      "pib": "123456789",
      "mb": "12345678",
      "activity_code": "4791",
      "jbkjs": null,
      "website": "https://primer.rs",
      "responsible_person": "Petar Petrović",
      "phone": "+381111234567",
      "is_customer": true,
      "is_supplier": false,
      "is_in_pdv": true,
      "assigned_to": "Marko Marković",
      "note": "Napomena o partneru",
      "other_data": null,
      "is_active": true,
      "payment_priority": 1,
      "group_code": "GRUPA01",
      "bank_accounts": [
        {
          "account_number": "160-123456-78",
          "sort_order": 0
        }
      ],
      "contacts": [
        {
          "contact_name": "Ana Anić",
          "position": "Direktor",
          "phone1": "+381641234567",
          "phone2": null,
          "email": "ana@primer.rs",
          "note": null
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

### Partner objekat

| Polje               | Tip      | Obavezan | Opis                                                    |
|---------------------|----------|----------|---------------------------------------------------------|
| `code`              | String   | Da       | Jedinstvena šifra partnera                              |
| `name`              | String   | Da       | Naziv partnera                                          |
| `legal_status`      | Integer  | Ne       | Pravni status: 1=Pravno lice, 2=Fizičko lice, 3=Javno preduzeće, 4=Ino partner |
| `address`           | String   | Ne       | Adresa                                                  |
| `postal_code`       | String   | Ne       | Poštanski broj                                          |
| `city`              | String   | Ne       | Grad/Mesto                                              |
| `country`           | String   | Ne       | Država (default: "Srbija", osim za legal_status=4)      |
| `email`             | String   | Ne       | Email adresa                                            |
| `pib`               | String   | Ne       | Poreski identifikacioni broj                            |
| `mb`                | String   | Ne       | Matični broj                                            |
| `activity_code`     | String   | Ne       | Šifra delatnosti                                        |
| `jbkjs`             | String   | Ne       | Jedinstveni broj korisnika javnih sredstava (max 31 kar)|
| `website`           | String   | Ne       | Web adresa                                              |
| `responsible_person`| String   | Ne       | Odgovorna osoba                                         |
| `phone`             | String   | Ne       | Telefon                                                 |
| `is_customer`       | Boolean  | Ne       | Da li je kupac (default: true)                          |
| `is_supplier`       | Boolean  | Ne       | Da li je dobavljač (default: false)                     |
| `is_in_pdv`         | Boolean  | Ne       | Da li je u sistemu PDV-a (default: true)                |
| `assigned_to`       | String   | Ne       | Zadužena osoba                                          |
| `note`              | String   | Ne       | Napomena                                                |
| `other_data`        | String   | Ne       | Ostali podaci                                           |
| `is_active`         | Boolean  | Ne       | Da li je aktivan (default: true)                        |
| `payment_priority`  | Integer  | Ne       | Prioritet plaćanja: 1, 2 ili 3 (default: 3)             |
| `group_code`        | String   | Ne       | Šifra grupe partnera (mora postojati u bazi)            |
| `bank_accounts`     | Array    | Ne       | Niz tekućih računa                                      |
| `contacts`          | Array    | Ne       | Niz kontakt osoba                                       |

### Tekući račun objekat

| Polje            | Tip     | Obavezan | Opis                           |
|------------------|---------|----------|--------------------------------|
| `account_number` | String  | Da       | Broj tekućeg računa            |
| `sort_order`     | Integer | Ne       | Redosled prikaza (default: 0)  |

### Kontakt osoba objekat

| Polje          | Tip    | Obavezan | Opis                    |
|----------------|--------|----------|-------------------------|
| `contact_name` | String | Da       | Ime i prezime kontakta  |
| `position`     | String | Ne       | Pozicija/funkcija       |
| `phone1`       | String | Ne       | Telefon 1               |
| `phone2`       | String | Ne       | Telefon 2               |
| `email`        | String | Ne       | Email adresa            |
| `note`         | String | Ne       | Napomena                |

---

## Greške

| Status | Opis                                          |
|--------|-----------------------------------------------|
| 400    | Neispravan zahtev (nedostaje company_id, loš format) |
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
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/partners-api?company_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### cURL - Uvoz

```bash
curl -X POST \
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/partners-api?company_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "update_existing": false,
    "data": [
      {
        "code": "TEST001",
        "name": "Test Partner",
        "is_customer": true
      }
    ]
  }'
```

### JavaScript/TypeScript

```typescript
import { supabase } from "@/integrations/supabase/client";

// Izvoz partnera
async function exportPartners(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await supabase.functions.invoke("partners-api", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: null,
  });
  
  // Alternativno, direktan fetch:
  const res = await fetch(
    `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/partners-api?company_id=${companyId}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    }
  );
  
  return res.json();
}

// Uvoz partnera
async function importPartners(companyId: string, partners: any[], updateExisting = false) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/partners-api?company_id=${companyId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: partners,
        update_existing: updateExisting,
      }),
    }
  );
  
  return res.json();
}
```

---

## Napomene

1. **Grupe partnera** - `group_code` mora odgovarati postojećoj šifri grupe u bazi za datu firmu. Ako grupa ne postoji, partner će biti uvezen bez grupe.

2. **Tekući računi i kontakti pri ažuriranju** - Kada se ažurira postojeći partner (`update_existing: true`), svi postojeći tekući računi i kontakti se brišu i zamenjuju novim iz zahteva.

3. **Minimalni podaci za uvoz** - Jedini obavezni podaci su `code` i `name`. Svi ostali imaju default vrednosti.

4. **Ograničenje pristupa** - Za izvoz je potreban pristup firmi (bilo koji korisnik sa pristupom). Za uvoz je potrebna admin uloga (super_admin ili local_admin za tu firmu).
