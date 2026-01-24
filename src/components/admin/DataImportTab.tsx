import { useState } from "react";
import { FileJson, Upload, Package, Users, Download, Building } from "lucide-react";
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

      {/* Partner Dialogs */}
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
    </div>
  );
}
