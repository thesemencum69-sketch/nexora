"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, Check, ChevronsUpDown, Keyboard, LogOut, Monitor, Moon, Plus, Settings, Sun, User, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/misc";
import { useCrm, useCurrentUser } from "@/hooks/use-crm";
import { PLANS } from "@/config/plans";
import { ROLES } from "@/lib/constants";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

export function PlanCard() {
  return (
    <Link
      href="/settings/billing"
      className="block rounded-xl border bg-background/60 p-3 shadow-card outline-none transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-white/[0.03]"
    >
      <div className="text-[13px] font-medium">Пробный период Pro</div>
      <Progress value={64} className="mt-2" />
      <div className="mt-2 text-xs text-muted-foreground">Осталось 5 дней из 14</div>
    </Link>
  );
}

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const workspace = useCrm((s) => s.workspace);
  const router = useRouter();
  const name = workspace.name || "Рабочее пространство";
  const plan = PLANS.find((p) => p.id === workspace.plan)?.name ?? "Pro";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-sidebar-accent",
          collapsed && "w-auto",
        )}
        aria-label="Сменить рабочее пространство"
      >
        <UserAvatar name={name} hue={268} shape="square" size="md" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{name}</span>
              <span className="block text-xs text-muted-foreground">Тариф {plan}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-64">
        <DropdownMenuLabel>Рабочие пространства</DropdownMenuLabel>
        <DropdownMenuItem>
          <UserAvatar name={name} hue={268} shape="square" size="sm" />
          <span className="truncate">{name}</span>
          <Check className="ml-auto !text-foreground" />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus />
          Создать пространство
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings/company")}>
          <Building2 />
          Настройки компании
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/team")}>
          <UserPlus />
          Пригласить в команду
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const openShortcuts = useUi((s) => s.setShortcutsOpen);
  const name = user?.name ?? "Семен";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-sidebar-accent",
          collapsed && "w-auto",
        )}
        aria-label="Меню профиля"
      >
        <UserAvatar name={name} hue={user?.hue} online={user ? true : undefined} />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user ? ROLES[user.role].label : "Загрузка…"}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[13px] font-medium text-foreground">{name}</span>
          <span className="block truncate">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings/profile")}>
          <User />
          Профиль
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings />
          Настройки
          <DropdownMenuShortcut>G S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openShortcuts(true)}>
          <Keyboard />
          Горячие клавиши
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Тема</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            Светлая
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            Тёмная
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            Как в системе
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/login")}>
          <LogOut />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
