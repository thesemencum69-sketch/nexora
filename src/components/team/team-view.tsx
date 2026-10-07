"use client";

import * as React from "react";
import { Check, Minus, MoreHorizontal, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { UserAvatar } from "@/components/common/user-avatar";
import { SalesPlanCard } from "@/components/plans/sales-plan";
import { useCrm, useCurrentUser, useNow, useReady } from "@/hooks/use-crm";
import { ROLES } from "@/lib/constants";
import { formatMoneyCompact, formatPercent } from "@/lib/format";
import { teamPerformance, type MemberPerformance, type PeriodKey } from "@/lib/metrics";
import { PERMISSIONS, can, canChangeRole } from "@/lib/permissions";
import { fieldErrors, inviteSchema, type FieldErrors } from "@/lib/validators";
import { plural } from "@/lib/utils";

const ROLE_ORDER: Role[] = ["owner", "admin", "manager", "employee"];

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useCrm((s) => s.inviteMember);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Exclude<Role, "owner">>("manager");
  const [errors, setErrors] = React.useState<FieldErrors>({});

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setRole("manager");
      setErrors({});
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    invite(parsed.data.email, parsed.data.role);
    onOpenChange(false);
    toast.success("Приглашение отправлено", { description: `${parsed.data.email}, роль «${ROLES[parsed.data.role].label}»` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Пригласить сотрудника</DialogTitle>
          <DialogDescription>Отправим ссылку для входа. Права можно поменять в любой момент.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Рабочий email" htmlFor="invite-email" error={errors.email}>
            <Input id="invite-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.ru" aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Роль" htmlFor="invite-role" hint={ROLES[role].description}>
            <Select value={role} onValueChange={(v: Exclude<Role, "owner">) => setRole(v)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["admin", "manager", "employee"] as const).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLES[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form="invite-form">
            Отправить приглашение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberCard({ row, actorRole }: { row: MemberPerformance; actorRole: Role }) {
  const { member } = row;
  const updateMember = useCrm((s) => s.updateMember);
  const removeMember = useCrm((s) => s.removeMember);
  const [confirm, setConfirm] = React.useState(false);
  const manageable = can(actorRole, "team.manage") && member.role !== "owner";
  const invited = member.position === "Приглашение отправлено";

  return (
    <article className="flex flex-col rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3">
        <UserAvatar name={member.name} hue={member.hue} size="lg" online={invited ? undefined : member.online} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{member.name}</h3>
          <p className="truncate text-[13px] text-muted-foreground">{member.position}</p>
        </div>
        {manageable && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`Действия: ${member.name}`}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Роль</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={member.role}
                onValueChange={(value) => {
                  const next = value as Role;
                  if (!canChangeRole(actorRole, member.role, next)) return;
                  updateMember(member.id, { role: next });
                  toast.success("Роль изменена", { description: `${member.name}: ${ROLES[next].label.toLowerCase()}` });
                }}
              >
                {(["admin", "manager", "employee"] as const).map((r) => (
                  <DropdownMenuRadioItem key={r} value={r} disabled={!canChangeRole(actorRole, member.role, r)}>
                    {ROLES[r].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2 />
                Удалить из команды
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={member.role === "owner" ? "brand" : "muted"}>{ROLES[member.role].label}</Badge>
        {invited && <Badge variant="warning">Ждёт подтверждения</Badge>}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
        <div>
          <dt className="text-xs text-muted-foreground">Сделки</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">{row.won}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Выручка</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">{formatMoneyCompact(row.revenue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Конверсия</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">{row.won + row.lost ? formatPercent(row.winRate) : "—"}</dd>
        </div>
      </dl>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Удалить ${member.name.split(" ")[0]} из команды?`}
        description="Сотрудник потеряет доступ. Его сделки, лиды и задачи перейдут к вам — ничего не потеряется."
        confirmLabel="Удалить доступ"
        onConfirm={() => {
          removeMember(member.id);
          toast("Сотрудник удалён", { description: `${member.name}: данные переданы вам` });
        }}
      />
    </article>
  );
}

export function TeamView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="cards" />;
  return <Team />;
}

function Team() {
  const members = useCrm((s) => s.members);
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const me = useCurrentUser();
  const now = useNow();
  const [period, setPeriod] = React.useState<PeriodKey>("30d");
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const perf = teamPerformance(members, { deals, leads }, period, now);
    return ROLE_ORDER.flatMap((role) => perf.filter((r) => r.member.role === role));
  }, [members, deals, leads, period, now]);
  const online = members.filter((m) => m.online).length;
  const actorRole = me?.role ?? "employee";

  return (
    <div className="animate-page space-y-6">
      <PageHeader
        title="Команда"
        description={`${members.length} ${plural(members.length, ["сотрудник", "сотрудника", "сотрудников"])}, ${online} сейчас в сети`}
        actions={
          <>
            <Segmented
              size="sm"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: "30d", label: "30 дней" },
                { value: "3m", label: "3 месяца" },
                { value: "1y", label: "Год" },
              ]}
              aria-label="Период показателей"
            />
            {can(actorRole, "team.manage") && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus />
                Пригласить
              </Button>
            )}
          </>
        }
      />

      <SalesPlanCard now={now} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <MemberCard key={row.member.id} row={row} actorRole={actorRole} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <ShieldCheck className="mt-0.5 size-5 text-primary" />
          <div>
            <CardTitle>Роли и права доступа</CardTitle>
            <CardDescription>Одни и те же правила проверяются в интерфейсе и на сервере. Данные компании видны только её сотрудникам.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="h-10 pl-5 text-left font-medium">Что можно делать</th>
                  {ROLE_ORDER.map((role) => (
                    <th key={role} className="h-10 px-3 text-center font-medium">
                      {ROLES[role].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((permission) => (
                  <tr key={permission.id} className="border-b last:border-0">
                    <td className="py-2.5 pl-5">{permission.label}</td>
                    {ROLE_ORDER.map((role) => (
                      <td key={role} className="px-3 py-2.5 text-center">
                        {can(role, permission.id) ? (
                          <Check className="mx-auto size-4 text-success-text" aria-label="Да" />
                        ) : (
                          <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Нет" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

