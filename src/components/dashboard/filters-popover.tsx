"use client";

import { SlidersHorizontal, X } from "lucide-react";
import type { ID, LeadSource } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SourceIcon } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { SOURCES } from "@/lib/constants";
import { NO_FILTERS, type AnalyticsFilters } from "@/lib/metrics";
import { useCrm } from "@/hooks/use-crm";

/** Фильтры по менеджеру и источнику — применяются ко всем цифрам на странице */
export function FiltersPopover({ value, onChange }: { value: AnalyticsFilters; onChange: (f: AnalyticsFilters) => void }) {
  const members = useCrm((s) => s.members);
  const active = (value.ownerId !== "all" ? 1 : 0) + (value.source !== "all" ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal />
          Фильтры
          {active > 0 && <span className="tabular rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{active}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="filter-owner">Менеджер</Label>
            <Select value={value.ownerId} onValueChange={(ownerId: ID) => onChange({ ...value, ownerId })}>
              <SelectTrigger id="filter-owner" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Вся команда</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <UserAvatar name={m.name} hue={m.hue} size="xs" />
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-source">Источник</Label>
            <Select value={value.source} onValueChange={(source: LeadSource | "all") => onChange({ ...value, source })}>
              <SelectTrigger id="filter-source" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <SourceIcon source={s.id} />
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {active > 0 && (
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange(NO_FILTERS)}>
              <X />
              Сбросить фильтры
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
