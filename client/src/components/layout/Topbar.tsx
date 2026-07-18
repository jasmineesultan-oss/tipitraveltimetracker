import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, UserCircle, Menu, Clock } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { adminLinks, employeeLinks } from "@/lib/navLinks";
import { cn, initials } from "@/lib/utils";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const links = (user?.role === "ADMIN" ? adminLinks : employeeLinks).filter(
    (link) => !link.requiresEmployeeProfile || !!user?.employee
  );

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>
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

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent>
          <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Clock className="h-4 w-4" />
            </div>
            <SheetTitle>TIPI</SheetTitle>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                  )
                }
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
