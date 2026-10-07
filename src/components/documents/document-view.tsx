"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, FileQuestion, Printer, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";
import type { DealDocument, Requisites } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { useCrm, useReady } from "@/hooks/use-crm";
import { formatDateLong, formatMoney } from "@/lib/format";
import { amountInWords } from "@/lib/money-words";
import { useUi } from "@/lib/store/ui-store";
import { DOCUMENT_KINDS, DocumentStatusBadge, documentTitle } from "./document-meta";
import { useDocumentActions } from "./use-document-actions";

const VAT_RATE: Record<Requisites["vat"], number> = { none: 0, vat5: 5, vat7: 7, vat20: 20 };

/** Строка для QR-кода оплаты по ГОСТ Р 56042-2014 — её читают приложения всех российских банков */
function paymentPayload(req: Requisites, doc: DealDocument) {
  const purpose = `Оплата по счёту № ${doc.number} от ${formatDateLong(doc.createdAt)}. ${req.vat === "none" ? "Без НДС" : `В т. ч. НДС ${VAT_RATE[req.vat]}%`}`;
  return [
    "ST00012",
    `Name=${req.legalName}`,
    `PersonalAcc=${req.account}`,
    `BankName=${req.bank}`,
    `BIC=${req.bik}`,
    `CorrespAcc=${req.corrAccount}`,
    `PayeeINN=${req.inn}`,
    `KPP=${req.kpp}`,
    `Sum=${Math.round(doc.total * 100)}`,
    `Purpose=${purpose}`,
  ].join("|");
}

function PaymentQr({ payload }: { payload: string }) {
  const [svg, setSvg] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    QRCode.toString(payload, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#171721", light: "#ffffff" } })
      .then((markup) => alive && setSvg(markup))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [payload]);
  return <div className="size-[118px] shrink-0 [&>svg]:size-full" role="img" aria-label="QR-код для оплаты" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function DocumentView({ id }: { id: string }) {
  const ready = useReady();
  React.useEffect(() => {
    void useCrm.getState().hydrate();
  }, []);
  if (!ready) return <PageSkeleton variant="form" />;
  return <DocumentScreen id={id} />;
}

function DocumentScreen({ id }: { id: string }) {
  const router = useRouter();
  const doc = useCrm((s) => s.documents.find((d) => d.id === id));
  const deal = useCrm((s) => (doc ? s.deals.find((d) => d.id === doc.dealId) : undefined));
  const client = useCrm((s) => (doc ? s.clients.find((c) => c.id === doc.clientId) : undefined));
  const owner = useCrm((s) => s.members.find((m) => m.id === (deal?.ownerId ?? doc?.createdBy)));
  const workspace = useCrm((s) => s.workspace);
  const { markPaid } = useDocumentActions();

  if (!doc) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <EmptyState
          icon={FileQuestion}
          title="Документ не найден"
          description="Возможно, сделку удалили вместе с документами."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/deals">К сделкам</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const req = workspace.requisites;
  const vatRate = VAT_RATE[req.vat];
  const vatAmount = vatRate ? Math.round((doc.total * vatRate) / (100 + vatRate)) : 0;
  const invoice = doc.kind === "invoice";
  const back = () => {
    if (deal) {
      router.push("/deals");
      useUi.getState().openDeal(deal.id);
    } else router.back();
  };

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft />
            К сделке
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{documentTitle(doc)}</span>
            <DocumentStatusBadge status={doc.status} kind={doc.kind} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {invoice && doc.status === "issued" && (
              <Button variant="outline" size="sm" onClick={() => markPaid(doc.id)}>
                <CircleCheck className="text-success-text" />
                Отметить оплату
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <Printer />
              Скачать PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 py-8 print:max-w-none print:p-0">
        {req.sample && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] print:hidden">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
            <p>
              Реквизиты демонстрационные. Укажите свои в{" "}
              <Link href="/settings/company" className="font-medium underline underline-offset-2">
                Настройки → Компания
              </Link>
              , и счёт можно будет отправлять клиентам.
            </p>
          </div>
        )}

        <article className="mx-auto bg-white p-[clamp(20px,6vw,56px)] text-[13px] leading-relaxed text-[#171721] shadow-overlay ring-1 ring-black/5 print:p-0 print:shadow-none print:ring-0">
          {invoice ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-[15px] font-semibold">{req.legalName || workspace.name}</p>
                  <p className="text-[#676873]">{req.address}</p>
                </div>
                <PaymentQr payload={paymentPayload(req, doc)} />
              </div>

              <table className="mt-6 w-full border-collapse text-[12px] [&_td]:border [&_td]:border-[#cfcfd6] [&_td]:px-2.5 [&_td]:py-1.5">
                <tbody>
                  <tr>
                    <td colSpan={2} rowSpan={2} className="align-top">
                      {req.bank}
                      <div className="mt-2 text-[11px] text-[#676873]">Банк получателя</div>
                    </td>
                    <td className="w-16">БИК</td>
                    <td className="tabular w-52">{req.bik}</td>
                  </tr>
                  <tr>
                    <td>Сч. №</td>
                    <td className="tabular">{req.corrAccount}</td>
                  </tr>
                  <tr>
                    <td className="tabular">ИНН {req.inn}</td>
                    <td className="tabular">КПП {req.kpp}</td>
                    <td rowSpan={2} className="align-top">
                      Сч. №
                    </td>
                    <td rowSpan={2} className="tabular align-top">
                      {req.account}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2}>
                      {req.legalName}
                      <div className="mt-2 text-[11px] text-[#676873]">Получатель</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h1 className="mt-8 border-b-2 border-[#171721] pb-2 text-[20px] font-semibold tracking-[-0.01em]">
                Счёт на оплату № {doc.number} от {formatDateLong(doc.createdAt)}
              </h1>
              <dl className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                <dt className="text-[#676873]">Поставщик</dt>
                <dd>
                  {req.legalName}, ИНН {req.inn}, КПП {req.kpp}, {req.address}
                </dd>
                <dt className="text-[#676873]">Покупатель</dt>
                <dd>{client ? [client.company || client.name, client.email, client.phone].filter(Boolean).join(", ") : "—"}</dd>
              </dl>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
                <div>
                  <p className="text-[15px] font-semibold text-[#6047e0]">{workspace.name}</p>
                  <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Коммерческое предложение</h1>
                  <p className="mt-1 text-[#676873]">
                    № {doc.number} от {formatDateLong(doc.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#676873]">Для</p>
                  <p className="font-semibold">{client?.name}</p>
                  {client?.company && <p>{client.company}</p>}
                </div>
              </div>
              <p className="mt-6 max-w-[60ch] text-[14px]">
                {client ? `${client.name.split(" ")[0]}, ` : ""}подготовили предложение по задаче «{deal?.title ?? DOCUMENT_KINDS.proposal.label}». Ниже — состав работ и стоимость.
              </p>
            </>
          )}

          <table className="mt-6 w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-y border-[#171721] text-left text-[11.5px] text-[#676873]">
                <th className="w-8 py-2 pr-2 font-medium">№</th>
                <th className="py-2 pr-2 font-medium">{invoice ? "Товары (работы, услуги)" : "Позиция"}</th>
                <th className="w-16 py-2 pr-2 text-right font-medium">Кол-во</th>
                <th className="w-14 py-2 pr-2 font-medium">Ед.</th>
                <th className="w-28 py-2 pr-2 text-right font-medium">Цена</th>
                <th className="w-32 py-2 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, index) => (
                <tr key={item.id} className="border-b border-[#e6e6ea] align-top">
                  <td className="tabular py-2 pr-2 text-[#676873]">{index + 1}</td>
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="tabular py-2 pr-2 text-right">{item.qty}</td>
                  <td className="py-2 pr-2">{item.unit}</td>
                  <td className="tabular py-2 pr-2 text-right">{formatMoney(item.price)}</td>
                  <td className="tabular py-2 text-right">{formatMoney(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full max-w-[320px] space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#676873]">Итого</span>
              <span className="tabular">{formatMoney(doc.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#676873]">{vatRate ? `В том числе НДС ${vatRate}%` : "НДС"}</span>
              <span className="tabular">{vatRate ? formatMoney(vatAmount) : "Без НДС"}</span>
            </div>
            <div className="flex justify-between border-t border-[#171721] pt-2 text-[15px] font-semibold">
              <span>{invoice ? "Всего к оплате" : "Стоимость"}</span>
              <span className="tabular">{formatMoney(doc.total)}</span>
            </div>
          </div>

          {invoice ? (
            <>
              <p className="mt-6">
                Всего наименований {doc.items.length}, на сумму {formatMoney(doc.total)}.<br />
                <span className="font-semibold">{amountInWords(doc.total)}</span>
              </p>
              <p className="mt-3 text-[12px] text-[#676873]">Оплатить можно по QR-коду в приложении любого банка. Счёт действителен 5 банковских дней.</p>
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {["Руководитель", "Бухгалтер"].map((role) => (
                  <div key={role} className="flex items-end gap-3">
                    <span className="shrink-0">{role}</span>
                    <span className="mb-1 flex-1 border-b border-[#171721]" />
                    <span className="shrink-0">{req.director}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-10 border-t pt-6">
              <div>
                <p className="max-w-[360px] text-[#676873]">Предложение действительно 14 дней. Ответим на вопросы и подстроим состав работ под вашу задачу.</p>
              </div>
              {owner && (
                <div className="text-right">
                  <p className="font-semibold">{owner.name}</p>
                  <p className="text-[#676873]">{owner.position}</p>
                  <p className="tabular">{owner.phone}</p>
                  <p>{owner.email}</p>
                </div>
              )}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
