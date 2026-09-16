'use client';

import {
  CalendarClock,
  CheckCircle2,
  CirclePause,
  CreditCard,
  Play,
  Plus,
  ReceiptText,
  RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  lastDateOfMonth,
  shiftMonthKey,
  type RecurrenceFrequency,
} from '@/lib/finance-rules';
import type {
  Account,
  CardStatement,
  CurrencyCode,
  FinanceData,
  RecurrenceRule,
} from '@/lib/finance';

const frequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

function money(cents: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(currency === 'EUR' ? 'pt-PT' : 'pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function monthName(month: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function statementTotal(data: FinanceData, statement: CardStatement) {
  if (statement.status !== 'open' && statement.closedTotalCents != null) {
    return statement.closedTotalCents;
  }
  return data.transactions
    .filter(
      (transaction) =>
        transaction.cardStatementId === statement.id &&
        transaction.kind !== 'transfer',
    )
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

function CardDialog({
  open,
  onOpenChange,
  saving,
  onSave,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (card: Account) => Promise<void>;
  currency: CurrencyCode;
}) {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [lastFour, setLastFour] = useState('');

  function parseMoney(value: string) {
    const normalized = value.includes(',')
      ? value.replace(/\./g, '').replace(',', '.')
      : value;
    const number = Number(normalized.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(number) ? Math.round(Math.abs(number) * 100) : 0;
  }

  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const creditLimitCents = parseMoney(limit);
    const close = Number(closingDay);
    const due = Number(dueDay);
    if (
      !name.trim() ||
      !creditLimitCents ||
      !Number.isInteger(close) ||
      !Number.isInteger(due) ||
      close < 1 ||
      close > 31 ||
      due < 1 ||
      due > 31
    ) {
      return;
    }
    void onSave({
      id: `card-${crypto.randomUUID()}`,
      name: name.trim(),
      type: 'credit',
      openingBalanceCents: 0,
      currency,
      closingDay: close,
      dueDay: due,
      creditLimitCents,
      cardLastFour: /^\d{4}$/.test(lastFour) ? lastFour : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
          <DialogDescription>
            Cadastre limite, fechamento e vencimento para organizar as faturas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="card-name">Nome do cartão</Label>
            <Input
              id="card-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: cartão principal"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="card-limit">Limite</Label>
              <Input
                id="card-limit"
                inputMode="decimal"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="card-last-four">Últimos 4 dígitos</Label>
              <Input
                id="card-last-four"
                inputMode="numeric"
                maxLength={4}
                value={lastFour}
                onChange={(event) =>
                  setLastFour(event.target.value.replace(/\D/g, ''))
                }
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="card-closing">Dia de fechamento</Label>
              <Input
                id="card-closing"
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(event) => setClosingDay(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="card-due">Dia de vencimento</Label>
              <Input
                id="card-due"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            >
              Salvar cartão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({
  statement,
  accounts,
  saving,
  onClose,
  onPay,
}: {
  statement: CardStatement | null;
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  onPay: (statement: CardStatement, sourceAccountId: string) => Promise<void>;
}) {
  const [sourceAccountId, setSourceAccountId] = useState('');
  const available = accounts.filter((account) => account.type !== 'credit');
  const selected = sourceAccountId || available[0]?.id || '';
  return (
    <Dialog
      open={Boolean(statement)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            O pagamento será registrado como transferência e não contará como
            uma nova despesa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="statement-source">Conta usada no pagamento</Label>
          <select
            id="statement-source"
            value={selected}
            onChange={(event) => setSourceAccountId(event.target.value)}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {available.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !selected || !statement}
            className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
            onClick={() => statement && void onPay(statement, selected)}
          >
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanningView({
  data,
  month,
  saving,
  onSaveCard,
  onCloseStatement,
  onPayStatement,
  onToggleRecurrence,
  onGenerateRecurrences,
}: {
  data: FinanceData;
  month: string;
  saving: boolean;
  onSaveCard: (card: Account) => Promise<void>;
  onCloseStatement: (statement: CardStatement) => Promise<void>;
  onPayStatement: (
    statement: CardStatement,
    sourceAccountId: string,
  ) => Promise<void>;
  onToggleRecurrence: (rule: RecurrenceRule) => Promise<void>;
  onGenerateRecurrences: (
    ruleId: string | null,
    throughDate: string,
  ) => Promise<void>;
}) {
  const [cardOpen, setCardOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<CardStatement | null>(null);
  const cards = data.accounts.filter((account) => account.type === 'credit');
  const throughDate = lastDateOfMonth(shiftMonthKey(month, 6));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-[#dfe9e5] shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5 text-[#0b7f71]" /> Cartões e
                faturas
              </CardTitle>
              <CardDescription>
                Compras entram uma vez na despesa; pagar a fatura vira
                transferência.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setCardOpen(true)}>
              <Plus /> Cartão
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {cards.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-[#cbdad5] p-8 text-center">
                <CreditCard className="mx-auto size-7 text-[#0b7f71]" />
                <p className="mt-3 font-semibold">
                  Cadastre seu primeiro cartão
                </p>
                <p className="mt-1 text-sm text-[#718681]">
                  Depois, escolha essa conta ao registrar uma compra.
                </p>
              </div>
            ) : (
              cards.map((card) => {
                const statement = data.cardStatements.find(
                  (item) =>
                    item.cardAccountId === card.id &&
                    item.cycleEnd.startsWith(month),
                );
                const used = statement ? statementTotal(data, statement) : 0;
                const limit = card.creditLimitCents ?? 0;
                const percentage = limit
                  ? Math.min(100, (used / limit) * 100)
                  : 0;
                return (
                  <article
                    key={card.id}
                    className="rounded-2xl bg-[#f5f9f7] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{card.name}</p>
                        <p className="text-xs text-[#718681]">
                          {card.cardLastFour
                            ? `final ${card.cardLastFour} · `
                            : ''}
                          fecha dia {card.closingDay} · vence dia {card.dueDay}
                        </p>
                      </div>
                      <Badge className="bg-white text-[#526e69]">
                        {statement?.status === 'paid'
                          ? 'Paga'
                          : statement?.status === 'closed'
                            ? 'Fechada'
                            : 'Aberta'}
                      </Badge>
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#718681]">
                          Fatura de {monthName(month)}
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                          {money(used, data.currency)}
                        </p>
                      </div>
                      <p className="text-right text-xs text-[#718681]">
                        disponível
                        <br />
                        <strong className="text-[#294c47]">
                          {money(Math.max(0, limit - used), data.currency)}
                        </strong>
                      </p>
                    </div>
                    <Progress value={percentage} className="mt-3" />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {statement?.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onCloseStatement(statement)}
                        >
                          <ReceiptText /> Fechar fatura
                        </Button>
                      )}
                      {statement?.status === 'closed' && (
                        <Button
                          size="sm"
                          className="bg-[#0b7f71] text-white hover:bg-[#096b60]"
                          onClick={() => setPayTarget(statement)}
                        >
                          <CheckCircle2 /> Pagar
                        </Button>
                      )}
                      {!statement && (
                        <span className="text-xs text-[#718681]">
                          Nenhuma compra nesta fatura.
                        </span>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-[#dfe9e5] bg-[#09211f] text-white shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarClock className="size-5 text-teal-300" /> Próximos seis
              meses
            </CardTitle>
            <CardDescription className="text-white/55">
              A geração só acontece quando você confirma — trocar de mês nunca
              cria lançamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={
                saving || !data.recurrenceRules.some((rule) => rule.active)
              }
              onClick={() => void onGenerateRecurrences(null, throughDate)}
              className="w-full bg-teal-300 text-[#071817] hover:bg-teal-200"
            >
              <RefreshCcw /> Gerar até {shortDate(throughDate)}
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="border-[#dfe9e5] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="size-5 text-[#0b7f71]" /> Recorrências
          </CardTitle>
          <CardDescription>
            Crie uma recorrência ao salvar um lançamento e controle cada série
            aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {data.recurrenceRules.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[#cbdad5] p-8 text-center text-sm text-[#718681]">
              Marque “Repetir lançamento” no formulário de um novo lançamento.
            </div>
          ) : (
            data.recurrenceRules.map((rule) => {
              const source = data.transactions.find(
                (transaction) => transaction.id === rule.sourceTransactionId,
              );
              return (
                <article
                  key={rule.id}
                  className="flex flex-col gap-4 rounded-2xl bg-[#f5f9f7] p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0b7f71]">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">
                        {source?.title ?? 'Lançamento recorrente'}
                      </p>
                      <Badge
                        className={
                          rule.active
                            ? 'bg-[#dff6ef] text-[#087667]'
                            : 'bg-slate-200 text-slate-600'
                        }
                      >
                        {rule.active ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#718681]">
                      {frequencyLabels[rule.frequency]} · próximo em{' '}
                      {shortDate(rule.nextDate)}
                      {source
                        ? ` · ${money(source.amountCents, data.currency)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {rule.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Gerar próximas ocorrências de ${source?.title ?? 'recorrência'}`}
                        onClick={() =>
                          void onGenerateRecurrences(rule.id, throughDate)
                        }
                      >
                        <Play /> Gerar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={
                        rule.active
                          ? 'Pausar recorrência'
                          : 'Reativar recorrência'
                      }
                      onClick={() => void onToggleRecurrence(rule)}
                    >
                      {rule.active ? <CirclePause /> : <Play />}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <CardDialog
        open={cardOpen}
        onOpenChange={setCardOpen}
        saving={saving}
        currency={data.currency}
        onSave={async (card) => {
          await onSaveCard(card);
          setCardOpen(false);
        }}
      />
      <PayDialog
        statement={payTarget}
        accounts={data.accounts}
        saving={saving}
        onClose={() => setPayTarget(null)}
        onPay={async (statement, sourceAccountId) => {
          await onPayStatement(statement, sourceAccountId);
          setPayTarget(null);
        }}
      />
    </div>
  );
}
