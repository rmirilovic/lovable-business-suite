import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, Lock, CheckCircle } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.string().min(6, "Lozinka mora imati najmanje 6 karaktera");

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    
    // Listen for auth state changes FIRST (recovery token will trigger this)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      console.log("Auth state change:", event, session?.user?.email);
      
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        // User came from recovery link or already signed in via recovery
        if (session) {
          setIsValidSession(true);
          setIsChecking(false);
        }
      } else if (event === "SIGNED_OUT") {
        setIsValidSession(false);
        setIsChecking(false);
      }
    });

    // Check for existing session after setting up listener
    // This handles the case where the page is already loaded with a valid session
    const checkSession = async () => {
      // Small delay to allow Supabase to process the URL hash/tokens
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!isMounted) return;
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log("Check session result:", session?.user?.email, error);
      
      if (session) {
        setIsValidSession(true);
      } else if (isChecking) {
        // Only show error if we haven't already validated through onAuthStateChange
        toast({
          title: "Nevažeći link",
          description: "Link za resetovanje lozinke je istekao ili nije validan. Zatražite novi link.",
          variant: "destructive",
        });
      }
      setIsChecking(false);
    };

    checkSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [toast, isChecking]);

  const validateForm = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Lozinke se ne poklapaju";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({
        title: "Greška",
        description: "Došlo je do greške prilikom promene lozinke. Pokušajte ponovo.",
        variant: "destructive",
      });
    } else {
      setIsSuccess(true);
      toast({
        title: "Uspešno",
        description: "Vaša lozinka je uspešno promenjena.",
      });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Provera linka...</p>
        </div>
      </div>
    );
  }

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
              {isSuccess ? "Lozinka promenjena" : "Nova lozinka"}
            </CardTitle>
            <CardDescription className="text-center">
              {isSuccess 
                ? "Vaša lozinka je uspešno ažurirana" 
                : "Unesite novu lozinku za vaš nalog"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Možete se sada prijaviti sa novom lozinkom.
                </p>
                <Button
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Idi na prijavu
                </Button>
              </div>
            ) : !isValidSession ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Link za resetovanje lozinke je istekao ili nije validan.
                  Molimo zatražite novi link.
                </p>
                <Button
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Nazad na prijavu
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova lozinka</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
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
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Potvrdite lozinku</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Čuvanje..." : "Sačuvaj novu lozinku"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
