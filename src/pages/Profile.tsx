import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Lock, User, Mail, Phone, Save, Camera, Loader2, Shield, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { usePermissions } from "@/hooks/usePermissions";

const passwordSchema = z.string().min(6, "Lozinka mora imati najmanje 6 karaktera");

export default function Profile() {
  const { user, isSuperAdmin, isLocalAdmin, companies, localAdminCompanyIds, selectedCompany } = useAuth();
  const { userRoles, isLoading: rolesLoading } = usePermissions();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!error && data) {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url);
      }
    };
    
    loadProfile();
  }, [user]);

  const getUserInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "KO";
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Molimo izaberite sliku");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Slika mora biti manja od 2MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success("Profilna slika je uspešno ažurirana");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Greška prilikom uploada slike");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoadingProfile(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      })
      .eq("id", user.id);
    
    setIsLoadingProfile(false);
    
    if (error) {
      toast.error("Greška prilikom ažuriranja profila");
    } else {
      toast.success("Profil je uspešno ažuriran");
    }
  };

  const validatePasswordForm = () => {
    const errors: typeof passwordErrors = {};
    
    if (!currentPassword) {
      errors.currentPassword = "Unesite trenutnu lozinku";
    }
    
    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        errors.newPassword = err.errors[0].message;
      }
    }
    
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Lozinke se ne poklapaju";
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    
    setIsLoadingPassword(true);
    
    // First verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    
    if (signInError) {
      setIsLoadingPassword(false);
      setPasswordErrors({ currentPassword: "Pogrešna trenutna lozinka" });
      return;
    }
    
    // Update to new password
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    setIsLoadingPassword(false);
    
    if (error) {
      toast.error("Greška prilikom promene lozinke");
    } else {
      toast.success("Lozinka je uspešno promenjena");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <MainLayout title="Moj profil">
      <div className="max-w-2xl space-y-6">
        {/* Avatar Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profilna slika
            </CardTitle>
            <CardDescription>
              Kliknite na sliku da biste je promenili
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar 
                  className="h-24 w-24 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={handleAvatarClick}
                >
                  <AvatarImage src={avatarUrl || undefined} alt="Profilna slika" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                <div 
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full cursor-pointer hover:bg-primary/90"
                  onClick={handleAvatarClick}
                >
                  <Camera className="h-4 w-4" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">
                  Preporučena veličina: 200x200px
                </p>
                <p className="text-xs text-muted-foreground">
                  Maksimalna veličina fajla: 2MB
                </p>
                <p className="text-xs text-muted-foreground">
                  Podržani formati: JPG, PNG, GIF
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* User Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Uloge i dozvole
            </CardTitle>
            <CardDescription>
              Vaše sistemske uloge i nivoi pristupa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Sistemska uloga</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {isSuperAdmin ? (
                    <Badge variant="destructive">
                      Super Admin
                    </Badge>
                  ) : isLocalAdmin ? (
                    <Badge variant="default">
                      Administrator
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Korisnik
                    </Badge>
                  )}
                </div>
              </div>

              {/* Custom assigned roles */}
              {!isSuperAdmin && !isLocalAdmin && (
                <div>
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Dodeljene uloge {selectedCompany && `(${selectedCompany.name})`}
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rolesLoading ? (
                      <span className="text-sm text-muted-foreground">Učitavanje...</span>
                    ) : userRoles.length > 0 ? (
                      userRoles.map(role => (
                        <Badge key={role.id} variant="outline" className="flex items-center gap-1">
                          {role.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Nema dodeljenih uloga za ovu firmu
                      </span>
                    )}
                  </div>
                  {userRoles.length > 0 && userRoles.some(r => r.description) && (
                    <div className="mt-3 space-y-1">
                      {userRoles.filter(r => r.description).map(role => (
                        <p key={role.id} className="text-xs text-muted-foreground">
                          <span className="font-medium">{role.name}:</span> {role.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isLocalAdmin && localAdminCompanyIds.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Administrator za kompanije</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {companies
                      .filter(c => localAdminCompanyIds.includes(c.id))
                      .map(company => (
                        <Badge key={company.id} variant="outline">
                          {company.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              <div className="pt-2 text-sm text-muted-foreground">
                {isSuperAdmin && (
                  <p>Kao Super Admin imate potpun pristup svim funkcionalnostima sistema.</p>
                )}
                {isLocalAdmin && !isSuperAdmin && (
                  <p>Kao Administrator imate proširena prava upravljanja za dodeljene kompanije.</p>
                )}
                {!isSuperAdmin && !isLocalAdmin && userRoles.length > 0 && (
                  <p>Vaša prava pristupa su definisana dodeljenim ulogama. Kontaktirajte administratora za izmene.</p>
                )}
                {!isSuperAdmin && !isLocalAdmin && userRoles.length === 0 && (
                  <p>Nemate dodeljene uloge. Kontaktirajte administratora za dozvole pristupa.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Lični podaci
            </CardTitle>
            <CardDescription>
              Ažurirajte vaše lične podatke
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ime</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Vaše ime"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Prezime</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Vaše prezime"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="pl-10 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email adresa se ne može promeniti
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+381 ..."
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button type="submit" disabled={isLoadingProfile}>
                <Save className="mr-2 h-4 w-4" />
                {isLoadingProfile ? "Čuvanje..." : "Sačuvaj izmene"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Promena lozinke
            </CardTitle>
            <CardDescription>
              Promenite lozinku za vaš nalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Trenutna lozinka</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova lozinka</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Potvrdite novu lozinku</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
              
              <Button type="submit" disabled={isLoadingPassword}>
                <Lock className="mr-2 h-4 w-4" />
                {isLoadingPassword ? "Menjanje..." : "Promeni lozinku"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
