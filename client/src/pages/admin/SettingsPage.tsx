import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Setting } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get<Setting[]>("/settings");
    setSettings(data);
    setValues(Object.fromEntries(data.map((s) => [s.key, s.value])));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSetting(key: string) {
    setSaving(key);
    setError(null);
    setSuccess(false);
    try {
      await api.put(`/settings/${key}`, { value: values[key] });
      setSuccess(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  if (!settings) return <PageSpinner />;

  return (
    <div className="max-w-2xl space-y-4">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">Setting saved</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>Working hours, shift schedule and other company-wide preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>{s.key.replace(/_/g, " ")}</Label>
                <Input value={values[s.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} />
                {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
              </div>
              <Button variant="outline" onClick={() => saveSetting(s.key)} disabled={saving === s.key}>
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
