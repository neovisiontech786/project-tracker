export type FounderName = string;
export type PaymentMethod = "Google Pay" | "PhonePe" | "Paytm" | "UPI" | "Bank Transfer" | "Cash" | "Card" | "Other";
export const PAYMENT_METHODS: PaymentMethod[] = ["Google Pay", "PhonePe", "Paytm", "UPI", "Bank Transfer", "Cash", "Card", "Other"];

export interface ProjectFinance {
  projectId: string;
  quotedPaise: number | null;
  updatedAt: string | null;
}
export interface ClientReceipt {
  id: string;
  projectId: string;
  amountPaise: number;
  paidAt: string;
  method: PaymentMethod;
  receivedBy: FounderName;
  reference: string;
  note: string;
  recordedBy: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}
export interface FounderTransfer {
  id: string;
  projectId: string;
  amountPaise: number;
  transferredAt: string;
  method: PaymentMethod;
  fromFounder: FounderName;
  toFounder: FounderName;
  reference: string;
  note: string;
  recordedBy: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}
export interface FinancePayload {
  participants?: {id:string;name:string;role:string;active:boolean}[];
  finance: ProjectFinance[];
  receipts: ClientReceipt[];
  transfers: FounderTransfer[];
}
export const EMPTY_FINANCE: FinancePayload = { finance: [], receipts: [], transfers: [] };
const moneyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function money(paise: number) { return moneyFormatter.format(paise / 100); }
export function moneyInput(paise: number | null) { return paise === null ? "" : (paise / 100).toFixed(2); }
export function activeReceipts(receipts: ClientReceipt[]) { return receipts.filter(r => !r.voidedAt); }
export function activeTransfers(transfers: FounderTransfer[]) { return transfers.filter(t => !t.voidedAt); }
export function sumPaise(rows: { amountPaise: number }[]) { return rows.reduce((sum, r) => sum + r.amountPaise, 0); }
export function duePaise(quote: number | null, received: number) { return Math.max(0, (quote ?? 0) - received); }
export function heldBy(founder: FounderName, receipts: ClientReceipt[], transfers: FounderTransfer[]) {
  const clients = sumPaise(activeReceipts(receipts).filter(r => r.receivedBy === founder));
  const incoming = sumPaise(activeTransfers(transfers).filter(t => t.toFounder === founder));
  const outgoing = sumPaise(activeTransfers(transfers).filter(t => t.fromFounder === founder));
  return { clients, incoming, outgoing, balance: clients + incoming - outgoing };
}
export function transactionDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}
export function currentLocalDatetime() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export async function financeRequest<T>(url: string, init?: RequestInit): Promise<T> {
  // A suspended database can take time to wake up. Never leave users in an
  // endless loading state if a network request hangs.
  const timeout = AbortSignal.timeout(25000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init, signal });
  } catch (error) {
    if (timeout.aborted) throw new Error("Payments are taking too long to load. Please try again.");
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Unable to contact the payment service. Check your connection and retry.");
  }
  const body = await response.json().catch(() => ({ error: "Unexpected server response." }));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body as T;
}
export async function financeMutation(data: Record<string, unknown>) {
  return financeRequest<{ success: boolean }>("/api/payments", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}
