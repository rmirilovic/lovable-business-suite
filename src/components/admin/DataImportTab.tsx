import { useState } from "react";
import { FileJson, Upload, Package, Users, Download, Building, BookOpen, Receipt, Factory, UserCheck, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PartnerImportDialog } from "@/components/partneri/PartnerImportDialog";
import { BankAccountImportDialog } from "@/components/partneri/BankAccountImportDialog";
import { ContactImportDialog } from "@/components/partneri/ContactImportDialog";
import { PartnerApiDialog } from "@/components/partneri/PartnerApiDialog";
import { ArticleApiDialog } from "@/components/sifarnici/ArticleApiDialog";
import { ArticleImportDialog } from "@/components/sifarnici/ArticleImportDialog";
import { ExportColumnsDialog } from "@/components/sifarnici/ExportColumnsDialog";
import { OrgUnitApiDialog } from "@/components/sifarnici/OrgUnitApiDialog";
import { OrgUnitImportDialog } from "@/components/sifarnici/OrgUnitImportDialog";
import { OrgUnitExportDialog } from "@/components/sifarnici/OrgUnitExportDialog";
import { ChartOfAccountsApiDialog } from "@/components/racunovodstvo/ChartOfAccountsApiDialog";
import { ChartOfAccountsImportDialog } from "@/components/racunovodstvo/ChartOfAccountsImportDialog";
import { ChartOfAccountsExportDialog } from "@/components/racunovodstvo/ChartOfAccountsExportDialog";
import { InputCostsApiDialog } from "@/components/sifarnici/InputCostsApiDialog";
import { InputCostsImportDialog } from "@/components/sifarnici/InputCostsImportDialog";
import { InputCostsExportDialog } from "@/components/sifarnici/InputCostsExportDialog";
import { NormImportDialog } from "@/components/proizvodnja/NormImportDialog";
import { PaymentCodesImportDialog } from "@/components/racunovodstvo/PaymentCodesImportDialog";
import { EmployeeImportDialog } from "@/components/zarade/EmployeeImportDialog";
import { VariantImportDialog } from "@/components/sifarnici/VariantImportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useArticles } from "@/hooks/useArticles";

export function DataImportTab() {
  const { selectedCompany } = useAuth();
  
  // Dialog states for partners
  const [partnerImportOpen, setPartnerImportOpen] = useState(false);
  const [bankAccountImportOpen, setBankAccountImportOpen] = useState(false);
  const [contactImportOpen, setContactImportOpen] = useState(false);
  const [partnerApiOpen, setPartnerApiOpen] = useState(false);
  
  // Dialog states for articles
  const [articleApiOpen, setArticleApiOpen] = useState(false);
  const [articleImportOpen, setArticleImportOpen] = useState(false);
  const [articleExportOpen, setArticleExportOpen] = useState(false);
  
  // Dialog states for organizational units
  const [orgUnitApiOpen, setOrgUnitApiOpen] = useState(false);
  const [orgUnitImportOpen, setOrgUnitImportOpen] = useState(false);
  const [orgUnitExportOpen, setOrgUnitExportOpen] = useState(false);
  
  // Dialog states for chart of accounts
  const [chartApiOpen, setChartApiOpen] = useState(false);
  const [chartImportOpen, setChartImportOpen] = useState(false);
  const [chartExportOpen, setChartExportOpen] = useState(false);
  
  // Dialog states for input costs
  const [inputCostsApiOpen, setInputCostsApiOpen] = useState(false);
  const [inputCostsImportOpen, setInputCostsImportOpen] = useState(false);
  const [inputCostsExportOpen, setInputCostsExportOpen] = useState(false);
  
  // Dialog states for norms
  const [normImportOpen, setNormImportOpen] = useState(false);
  
  // Dialog states for payment codes
  const [paymentCodesImportOpen, setPaymentCodesImportOpen] = useState(false);
  
  // Dialog states for employees
  const [employeeImportOpen, setEmployeeImportOpen] = useState(false);
  
  // Dialog states for variants
  const [variantImportOpen, setVariantImportOpen] = useState(false);
  
  // Article data for export
  const { articles } = useArticles(selectedCompany?.id);

  return (
    <div className="space-y-6">
      {/* Partners Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Partneri
          </CardTitle>
          <CardDescription>
            Uvoz i izvoz podataka o partnerima, bankovnim računima i kontaktima
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setPartnerApiOpen(true)}
            >
              <FileJson className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">API Partneri</div>
                <div className="text-xs text-muted-foreground">JSON uvoz/izvoz</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setPartnerImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz partnera</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setBankAccountImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz računa</div>
                <div className="text-xs text-muted-foreground">Bankovni računi</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setContactImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz kontakata</div>
                <div className="text-xs text-muted-foreground">Kontakt osobe</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Articles Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Artikli
          </CardTitle>
          <CardDescription>
            Uvoz i izvoz podataka o artiklima i klasifikacijama
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setArticleApiOpen(true)}
            >
              <FileJson className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">API Artikli</div>
                <div className="text-xs text-muted-foreground">JSON uvoz/izvoz</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setArticleImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setArticleExportOpen(true)}
            >
              <Download className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Izvoz u Excel</div>
                <div className="text-xs text-muted-foreground">Izvoz artikala</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Organizational Units Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Organizacione jedinice
          </CardTitle>
          <CardDescription>
            Uvoz i izvoz organizacionih jedinica (mesta troška)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setOrgUnitApiOpen(true)}
            >
              <FileJson className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">API Org. jedinice</div>
                <div className="text-xs text-muted-foreground">JSON uvoz/izvoz</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setOrgUnitImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setOrgUnitExportOpen(true)}
            >
              <Download className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Izvoz u Excel</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Chart of Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Kontni plan
          </CardTitle>
          <CardDescription>
            Uvoz i izvoz kontnog plana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setChartApiOpen(true)}
            >
              <FileJson className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">API Kontni plan</div>
                <div className="text-xs text-muted-foreground">JSON uvoz/izvoz</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setChartImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setChartExportOpen(true)}
            >
              <Download className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Izvoz u Excel</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Input Costs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Ulazni troškovi
          </CardTitle>
          <CardDescription>
            Uvoz i izvoz šifarnika ulaznih troškova
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setInputCostsApiOpen(true)}
            >
              <FileJson className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">API Troškovi</div>
                <div className="text-xs text-muted-foreground">JSON uvoz/izvoz</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setInputCostsImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setInputCostsExportOpen(true)}
            >
              <Download className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Izvoz u Excel</div>
                <div className="text-xs text-muted-foreground">Excel fajl</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Norms Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Normativi utroška materijala
          </CardTitle>
          <CardDescription>
            Uvoz normativa iz Excel fajla za više gotovih proizvoda odjednom
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setNormImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Normativi (flat)</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Payment Codes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Šifarnik plaćanja
          </CardTitle>
          <CardDescription>
            Uvoz šifarnika plaćanja iz Excel fajla
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setPaymentCodesImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Šifre plaćanja</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Employees Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Zaposleni
          </CardTitle>
          <CardDescription>
            Uvoz šifarnika zaposlenih iz Excel fajla
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setEmployeeImportOpen(true)}
            >
              <Upload className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Uvoz iz Excel-a</div>
                <div className="text-xs text-muted-foreground">Šifarnik radnika</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
      <PartnerImportDialog 
        open={partnerImportOpen} 
        onOpenChange={setPartnerImportOpen} 
      />
      <BankAccountImportDialog 
        open={bankAccountImportOpen} 
        onOpenChange={setBankAccountImportOpen} 
      />
      <ContactImportDialog 
        open={contactImportOpen} 
        onOpenChange={setContactImportOpen} 
      />
      <PartnerApiDialog 
        open={partnerApiOpen} 
        onOpenChange={setPartnerApiOpen} 
      />

      {/* Article Dialogs */}
      <ArticleApiDialog 
        open={articleApiOpen} 
        onOpenChange={setArticleApiOpen} 
      />
      <ArticleImportDialog
        open={articleImportOpen}
        onOpenChange={setArticleImportOpen}
      />
      <ExportColumnsDialog
        open={articleExportOpen}
        onOpenChange={setArticleExportOpen}
        articles={articles}
        companyName={selectedCompany?.name}
      />

      {/* Organizational Unit Dialogs */}
      <OrgUnitApiDialog 
        open={orgUnitApiOpen} 
        onOpenChange={setOrgUnitApiOpen} 
      />
      <OrgUnitImportDialog 
        open={orgUnitImportOpen} 
        onOpenChange={setOrgUnitImportOpen} 
      />
      <OrgUnitExportDialog 
        open={orgUnitExportOpen} 
        onOpenChange={setOrgUnitExportOpen} 
      />

      {/* Chart of Accounts Dialogs */}
      <ChartOfAccountsApiDialog 
        open={chartApiOpen} 
        onOpenChange={setChartApiOpen} 
      />
      <ChartOfAccountsImportDialog 
        open={chartImportOpen} 
        onOpenChange={setChartImportOpen} 
      />
      <ChartOfAccountsExportDialog 
        open={chartExportOpen} 
        onOpenChange={setChartExportOpen} 
      />

      {/* Input Costs Dialogs */}
      <InputCostsApiDialog 
        open={inputCostsApiOpen} 
        onOpenChange={setInputCostsApiOpen} 
      />
      <InputCostsImportDialog 
        open={inputCostsImportOpen} 
        onOpenChange={setInputCostsImportOpen} 
      />
      <InputCostsExportDialog 
        open={inputCostsExportOpen} 
        onOpenChange={setInputCostsExportOpen} 
      />

      {/* Norm Dialogs */}
      <NormImportDialog 
        open={normImportOpen} 
        onOpenChange={setNormImportOpen} 
      />

      {/* Payment Codes Dialogs */}
      <PaymentCodesImportDialog 
        open={paymentCodesImportOpen} 
        onOpenChange={setPaymentCodesImportOpen} 
      />

      {/* Employee Dialogs */}
      <EmployeeImportDialog 
        open={employeeImportOpen} 
        onOpenChange={setEmployeeImportOpen} 
      />
    </div>
  );
}
