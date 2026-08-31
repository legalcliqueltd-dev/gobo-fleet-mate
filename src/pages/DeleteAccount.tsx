import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** The real address, and the one the privacy policy publishes. */
const SUPPORT_EMAIL = "gobeth.ltd@gmail.com";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteRequest = async () => {
    if (!user) {
      toast.error("You must be logged in to delete your account.");
      return;
    }

    setDeleting(true);
    try {
      // Deletes for real, here and now. This used to email a request and
      // promise action "within 7 days", which App Store guideline 5.1.1(v)
      // does not accept: an app that creates accounts must delete them from
      // inside the app, not queue a support ticket.
      const { data, error } = await supabase.functions.invoke("delete-account");

      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? "Deletion failed");
      }

      toast.success("Your account and all its data have been permanently deleted.");
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[DeleteAccount] deletion failed:", err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : `Could not delete your account. Please email ${SUPPORT_EMAIL}.`
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <section className="py-16 bg-gradient-to-b from-destructive/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-2xl mb-6">
            <Trash2 className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Delete Your Account</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Permanently delete your FleetTrackMate account and all associated data.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-2xl space-y-8">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                What gets deleted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-muted-foreground">
                {[
                  "Your profile and login credentials",
                  "All devices and location history",
                  "Driver connections and trip records",
                  "Geofences, tasks, and reports",
                  "Subscription and billing data",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-destructive rounded-full mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mt-4">
                Deletion is permanent, immediate, and cannot be undone.
              </p>
            </CardContent>
          </Card>

          {user ? (
            <Card className="border-destructive/30">
              <CardContent className="pt-6 space-y-4">
                {!confirming ? (
                  <Button variant="destructive" className="w-full" onClick={() => setConfirming(true)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete My Account
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-destructive">
                      Are you sure? This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={handleDeleteRequest} disabled={deleting}>
                        {deleting ? "Submitting…" : "Yes, delete my account"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="pt-6 space-y-4">
                <p className="text-muted-foreground">
                  <strong>Not logged in?</strong> Sign in to delete your account instantly, or email us and we will do it for you.
                </p>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Account%20Deletion%20Request`}
                    className="text-primary underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
                <Link to="/auth/login">
                  <Button variant="outline" className="w-full mt-2">Sign in to delete my account</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default DeleteAccount;
