import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { usePartnerContacts, PartnerContact, PartnerContactInsert } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PartnerContactsTabProps {
  partnerId: string;
}

const defaultContactData = {
  contact_name: "",
  position: "",
  phone1: "",
  phone2: "",
  email: "",
  note: "",
};

export function PartnerContactsTab({ partnerId }: PartnerContactsTabProps) {
  const { selectedCompany } = useAuth();
  const {
    contacts,
    isLoading,
    createContact,
    updateContact,
    deleteContact,
    isCreating,
    isUpdating,
  } = usePartnerContacts(partnerId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [formData, setFormData] = useState(defaultContactData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormData(defaultContactData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (contact: PartnerContact) => {
    setEditingContact(contact);
    setFormData({
      contact_name: contact.contact_name,
      position: contact.position || "",
      phone1: contact.phone1 || "",
      phone2: contact.phone2 || "",
      email: contact.email || "",
      note: contact.note || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedCompany || !formData.contact_name.trim()) return;

    if (editingContact) {
      await updateContact({
        id: editingContact.id,
        updates: formData,
      });
    } else {
      await createContact({
        partner_id: partnerId,
        company_id: selectedCompany.id,
        ...formData,
      });
    }

    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteContact(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Nova kontakt osoba
        </Button>
      </div>

      {/* Contacts table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime i prezime</TableHead>
              <TableHead>Funkcija</TableHead>
              <TableHead>Telefon 1</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nema definisanih kontakt osoba
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.contact_name}</TableCell>
                  <TableCell>{contact.position || "-"}</TableCell>
                  <TableCell>{contact.phone1 || "-"}</TableCell>
                  <TableCell>{contact.email || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(contact)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(contact.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Contact form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Izmena kontakta" : "Nova kontakt osoba"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="contact_name">Ime i prezime *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => updateField("contact_name", e.target.value.slice(0, 63))}
                maxLength={63}
              />
            </div>

            <div>
              <Label htmlFor="position">Funkcija</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => updateField("position", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone1">Telefon 1</Label>
                <Input
                  id="phone1"
                  value={formData.phone1}
                  onChange={(e) => updateField("phone1", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone2">Telefon 2</Label>
                <Input
                  id="phone2"
                  value={formData.phone2}
                  onChange={(e) => updateField("phone2", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="note">Napomena</Label>
              <Input
                id="note"
                value={formData.note}
                onChange={(e) => updateField("note", e.target.value.slice(0, 63))}
                maxLength={63}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.note?.length || 0}/63 karaktera
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Odustani
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || isUpdating || !formData.contact_name.trim()}
            >
              {editingContact ? "Sačuvaj" : "Dodaj"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje kontakta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovu kontakt osobu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
