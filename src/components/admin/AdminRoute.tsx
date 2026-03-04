import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const STORAGE_KEY = "pipeline_admin_authed";
const ADMIN_SECRET = import.meta.env.VITE_PIPELINE_ADMIN_SECRET ?? "";

function isAuthed() {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isAuthed);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === ADMIN_SECRET) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="h-10 w-10 text-primary mb-2" />
          <CardTitle>Admin Access</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Enter admin secret"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">Incorrect secret.</p>}
            <Button type="submit" className="w-full">Enter</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
