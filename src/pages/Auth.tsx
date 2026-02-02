import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Lock, Mail, User, ArrowLeft } from "lucide-react";
import { z } from "zod";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" className="mr-2">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const emailSchema = z.string().email("Unesite validnu email adresu");
const passwordSchema = z.string().min(6, "Lozinka mora imati najmanje 6 karaktera");

function getPreferredPublicAppUrl() {
  // Workaround for certain hosted preview domains that route auth links through an auth bridge.
  // If we are on <projectId>.lovableproject.com, prefer the canonical preview domain:
  // https://id-preview--<projectId>.lovable.app
  try {
    const host = window.location.hostname;
    if (host.endsWith(".lovableproject.com")) {
      const projectId = host.split(".")[0];
      if (projectId) return `https://id-preview--${projectId}.lovable.app`;
    }
  } catch {
    // ignore
  }
  return window.location.origin;
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // If the user opened an email recovery link but landed on /auth (common when redirect URLs
    // are misconfigured or emails point to a different route), forward them to /reset-password
    // while preserving the URL params/hash that the auth client needs to complete the flow.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);

    const isRecoveryFlow =
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      searchParams.has("code") ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token");

    if (isRecoveryFlow && !window.location.pathname.startsWith("/reset-password")) {
      window.location.replace(
        `/reset-password${window.location.search}${window.location.hash}`
      );
    }
  }, []);

  useEffect(() => {
    // Don't redirect if the user is in the password recovery flow.
    // Supabase can pass `type=recovery` either in URL hash or query params.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const isRecoveryFlow =
      hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";

    // Also don't redirect while user is on reset-password page.
    const isOnResetPassword = window.location.pathname.startsWith("/reset-password");

    if (user && !isRecoveryFlow && !isOnResetPassword) navigate("/");
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      let message = "Greška prilikom prijave";
      if (error.message.includes("Invalid login credentials")) {
        message = "Pogrešna email adresa ili lozinka";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Email adresa nije potvrđena";
      }
      toast({
        title: "Greška",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, firstName, lastName);
    setIsLoading(false);

    if (error) {
      let message = "Greška prilikom registracije";
      if (error.message.includes("User already registered")) {
        message = "Korisnik sa ovom email adresom već postoji";
      }
      toast({
        title: "Greška",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uspešno",
        description: "Registracija je uspešna. Možete se prijaviti.",
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors({ email: err.errors[0].message });
        return;
      }
    }
    
    setIsLoading(true);
    const redirectBase = getPreferredPublicAppUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/reset-password`,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: "Greška",
        description: "Došlo je do greške prilikom slanja emaila za resetovanje lozinke.",
        variant: "destructive",
      });
    } else {
      setResetEmailSent(true);
      toast({
        title: "Email poslat",
        description: "Proverite vaš email za link za resetovanje lozinke.",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const redirectBase = getPreferredPublicAppUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectBase,
      },
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: "Greška",
        description: "Došlo je do greške prilikom Google prijave.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-primary p-3 rounded-xl">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="ml-3">
            <h1 className="text-2xl font-bold text-foreground">Mini ERP</h1>
            <p className="text-sm text-muted-foreground">Poslovno rešenje</p>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              {showForgotPassword ? "Resetovanje lozinke" : "Dobrodošli"}
            </CardTitle>
            <CardDescription className="text-center">
              {showForgotPassword 
                ? "Unesite email adresu za resetovanje lozinke" 
                : "Prijavite se ili kreirajte novi nalog"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <div className="space-y-4">
                {resetEmailSent ? (
                  <div className="text-center space-y-4">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-sm text-foreground">
                        Link za resetovanje lozinke je poslat na <strong>{email}</strong>.
                        Proverite vaš inbox (i spam folder).
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmailSent(false);
                        setEmail("");
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Nazad na prijavu
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="vas@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Slanje..." : "Pošalji link za resetovanje"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setErrors({});
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Nazad na prijavu
                    </Button>
                  </form>
                )}
              </div>
            ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Prijava</TabsTrigger>
                <TabsTrigger value="register">Registracija</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="vas@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Lozinka</Label>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setErrors({});
                        }}
                      >
                        Zaboravili ste lozinku?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Prijava..." : "Prijavite se"}
                  </Button>
                  
                  <div className="relative my-4">
                    <Separator />
                  </div>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setErrors({});
                      }}
                    >
                      Zaboravili ste lozinku?
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Ime</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="Ime"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Prezime</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Prezime"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="vas@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Lozinka</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Registracija..." : "Registrujte se"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
