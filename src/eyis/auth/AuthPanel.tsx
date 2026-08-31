/**
 * EYIS Auth Panel — die Anmelde- und Registrierungsoberfläche des Backoffice.
 *
 * Sie liegt bewusst in einer Komponente statt in einer Route: der reservierte
 * EYIS-Pfad `/app/login` und der historische Pfad `/auth` rendern dieselbe
 * Oberfläche. In einer Dedicated-Installation kann ein Kundenprojekt damit
 * einen eigenen `/login` oder `/auth` besitzen, ohne mit EYIS zu kollidieren.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EyisLogo } from "@/eyis/brand/EyisLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signInWithOAuthProvider } from "@/eyis/auth/oauth";
import { supabase } from "@/integrations/supabase/client";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export function AuthPanel({ authPath }: { authPath: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState("/app");
  const [ownerSetup, setOwnerSetup] = useState(false);

  useEffect(() => {
    const target = safeNext(new URLSearchParams(window.location.search).get("next"));
    setNext(target);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
    fetch("/api/public/install/setup-state")
      .then((r) => r.json())
      .then((s: { ownerRegistrationRequired?: boolean }) =>
        setOwnerSetup(s?.ownerRegistrationRequired === true),
      )
      .catch(() => setOwnerSetup(false));
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: next });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!signUpData.session) {
      toast.success("Konto erstellt. Bitte bestätige die E-Mail und melde dich anschließend an.");
      return;
    }
    navigate({ to: next });
  }

  async function google() {
    const { error } = await signInWithOAuthProvider(
      "google",
      `${window.location.origin}${authPath}`,
    );
    if (error) {
      toast.error("Google-Anmeldung fehlgeschlagen.");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Link to="/" aria-label="EYIS Startseite">
          <EyisLogo variant="wordmark" width={110} />
        </Link>
        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight">
            Ein Betriebssystem für deinen gesamten Handel.
          </h1>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            Organisationen, Shops, Rollen und Einladungen – sauber getrennt, lückenlos
            protokolliert.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">EYIS Backoffice</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <EyisLogo variant="full" width={240} className="max-w-[70vw]" />
          </div>
          {ownerSetup && (
            <div className="mb-6 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">EYIS einrichten</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Diese Instanz ist noch nicht übernommen. Lege das Administrator-Konto mit genau der
                beim Setup hinterlegten E-Mail-Adresse an und bestätige die Adresse. Die Übernahme
                läuft danach automatisch – kein Claim-Code nötig.
              </p>
            </div>
          )}
          <Tabs defaultValue={ownerSetup ? "signup" : "signin"} key={ownerSetup ? "s" : "i"}>
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Anmelden
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Registrieren
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Anmelden
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">E-Mail</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Passwort</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Konto erstellen
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> oder{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Mit Google fortfahren
          </Button>
        </div>
      </section>
    </main>
  );
}
