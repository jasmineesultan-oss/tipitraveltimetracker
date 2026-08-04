import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";
import type { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { initials, formatRate } from "@/lib/utils";

function ProfileForm({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const { register, handleSubmit, formState } = useForm<{ phone?: string }>({
    defaultValues: { phone: employee.phone || "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(values: { phone?: string }) {
    setError(null);
    setSuccess(false);
    try {
      await api.put(`/employees/${employee.id}/profile`, values);
      setSuccess(true);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">Profile updated successfully</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Employee Code</Label>
          <Input value={employee.employeeCode} disabled />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input value={employee.email} disabled />
        </div>
        <div className="space-y-1">
          <Label>First Name</Label>
          <Input value={employee.firstName} disabled />
        </div>
        <div className="space-y-1">
          <Label>Last Name</Label>
          <Input value={employee.lastName} disabled />
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Input value={employee.department?.name || "—"} disabled />
        </div>
        <div className="space-y-1">
          <Label>Position</Label>
          <Input value={employee.position?.title || "—"} disabled />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="+63 900 000 0000" />
        </div>
      </div>
      <Button type="submit" disabled={formState.isSubmitting}>
        Save Changes
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const { register, handleSubmit, reset, formState } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(values: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    setError(null);
    setSuccess(false);
    if (values.newPassword !== values.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    try {
      await api.post("/auth/change-password", { currentPassword: values.currentPassword, newPassword: values.newPassword });
      setSuccess(true);
      reset();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">Password changed successfully</Alert>}
      <div className="space-y-1">
        <Label>Current Password</Label>
        <Input type="password" {...register("currentPassword", { required: true })} />
      </div>
      <div className="space-y-1">
        <Label>New Password</Label>
        <Input type="password" {...register("newPassword", { required: true, minLength: 8 })} />
      </div>
      <div className="space-y-1">
        <Label>Confirm New Password</Label>
        <Input type="password" {...register("confirmPassword", { required: true })} />
      </div>
      <Button type="submit" disabled={formState.isSubmitting}>
        Change Password
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);

  async function load() {
    if (!user?.employee) return;
    const { data } = await api.get<Employee>(`/employees/${user.employee.id}`);
    setEmployee(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user?.employee || !employee) return <PageSpinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
          {initials(employee.firstName, employee.lastName)}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-sm text-slate-500">{employee.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            employee={employee}
            onSaved={() => {
              load();
              refreshUser();
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label>Daily Rate</Label>
            <p className="text-lg font-semibold text-slate-900">{formatRate(employee.dailyRate)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
