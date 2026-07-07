import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { initials } from "@/lib/utils";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationsDropdown />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {initials(user?.employee?.firstName, user?.employee?.lastName) || <UserCircle className="h-5 w-5" />}
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">
                {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <DropdownMenu.Item
                onSelect={() => navigate("/profile")}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100"
              >
                <UserCircle className="h-4 w-4" /> Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={onLogout}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
