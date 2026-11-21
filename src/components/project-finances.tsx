"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowLeftRight, Banknote, CheckCircle2, CircleHelp, IndianRupee, PencilLine, Plus, ReceiptText, ShieldCheck, X } from "lucide-react";
import { Modal } from "@/components/ui";
import { useHub } from "@/lib/project-store";
import { useAuth } from "@clerk/nextjs";
import {
  activeReceipts, activeTransfers, currentLocalDatetime, duePaise, financeMutation,
  financeRequest, heldBy, money, moneyInput, PAYMENT_METHODS, sumPaise, transactionDate,
  type ClientReceipt, type FinancePayload, type FounderName, type FounderTransfer,
} from "@/lib/finance";

export function ProjectFinances({ projectId, viewerName }: { projectId: string; viewerName: string }) {
  const { userId } = useAuth();
  const {teamMembers,viewerId}=useHub();
  const holders=teamMembers.filter(m=>m.role==="founder"||m.role==="admin");
  const defaultHolder=holders.some(m=>m.id===viewerId)?viewerId:(holders[0]?.id||"");
  const scope = `${userId || "guest"}:${projectId}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [loadedScope, setLoadedScope] = useState("");
  const [data, setData] = useState<FinancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [quotedAmount, setQuotedAmount] = useState("");
  const [quoteEditing, setQuoteEditing] = useState(false);
  const [form, setForm] = useState<"receipt" | "transfer" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("Google Pay");
  const [receivedBy, setReceivedBy] = useState<FounderName>(defaultHolder);
  const [fromFounder, setFromFounder] = useState<FounderName>(defaultHolder);
  const [toFounder, setToFounder] = useState<FounderName>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const requestId = useRef<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);

  const load = useCallback(async () => {
    const requestedScope = scope;
    const next = await financeRequest<FinancePayload>(`/api/payments?projectId=${encodeURIComponent(projectId)}`);
    if (currentScope.current === requestedScope) { setData(next); setLoadedScope(requestedScope); }
    return next;
  }, [projectId, scope]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null); setLoadedScope(""); setQuoteEditing(false);
    if (!userId) { setLoading(false); return () => { active = false; }; }
    financeRequest<FinancePayload>(`/api/payments?projectId=${encodeURIComponent(projectId)}`)
      .then(result => { if (active) { setData(result); setLoadedScope(scope); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load payments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, scope, userId]);

  const safeData = loadedScope === scope ? data : null;
  const finance = safeData?.finance.find(x => x.projectId === projectId);
  const quote = finance?.quotedPaise ?? null;
  const receipts = (safeData?.receipts || []).filter(r => r.projectId === projectId);
  const transfers = (safeData?.transfers || []).filter(t => t.projectId === projectId);
  const activeClientPayments = activeReceipts(receipts);
  const activeFounders = activeTransfers(transfers);
  const received = sumPaise(activeClientPayments);
  const due = duePaise(quote, received);
  const overpaid = quote === null ? 0 : Math.max(0, received - quote);


  function editQuote() { setQuotedAmount(moneyInput(quote)); setQuoteEditing(true); setMessage(""); setError(""); }
  async function submitQuote(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    try {
      await financeMutation({ action: "quote", projectId, amount: quotedAmount.trim() });
      await load(); setQuoteEditing(false); setMessage("Quotation updated successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update quotation."); }
    finally { setSaving(false); }
  }
  function openForm(next: "receipt" | "transfer") {
    setForm(next); setAmount(""); setDate(currentLocalDatetime()); setMethod("Google Pay");
    setReceivedBy(defaultHolder);
    setFromFounder(defaultHolder);setToFounder(holders.find(m=>m.id!==defaultHolder)?.id||"");
    setReference(""); setNote(""); setMessage(""); setError(""); requestId.current = null;
  }
  function closeForm() { setForm(null); requestId.current = null; setError(""); }
  function editField(setter: (value: string) => void, value: string) { setter(value); requestId.current = null; }
  async function submitEntry(event: FormEvent) {
    event.preventDefault(); if (!form || !date) return;
    setSaving(true); setError(""); setMessage("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const timestamp = new Date(date);
      if (Number.isNaN(timestamp.getTime())) throw new Error("Please choose a valid transaction date and time.");
      const common = { projectId, amount: amount.trim(), method, reference: reference.trim(), note: note.trim(), requestId: requestId.current };
      if (form === "receipt") await financeMutation({ action: "receipt", ...common, paidAt: timestamp.toISOString(), receivedBy });
      else await financeMutation({ action: "transfer", ...common, transferredAt: timestamp.toISOString(), fromFounder, toFounder });
      await load();
      setMessage(form === "receipt" ? "Client payment recorded successfully." : "Founder transfer recorded successfully.");
      closeForm();
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save the transaction."); }
    finally { setSaving(false); }
  }
  async function voidEntry(kind: "receipt" | "transfer", record: ClientReceipt | FounderTransfer) {
    const reason = window.prompt(`Void this ${kind === "receipt" ? "client payment" : "founder transfer"} of ${money(record.amountPaise)}?\nGive a reason for the correction (minimum 5 characters):`);
    if (reason === null) return;
    if (reason.trim().length < 5) { setError("Please enter a correction reason of at least 5 characters."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await financeMutation({ action: "void", projectId, kind, recordId: record.id, reason: reason.trim() });
      await load(); setMessage("Transaction voided. The original record remains visible in history.");
    } catch(e) { setError(e instanceof Error ? e.message : "Correction failed."); }
    finally { setSaving(false); }
  }
  if (loading || (!safeData && !error)) return <div className="payment-shell"><div className="surface-card payment-empty">Loading payment records…</div></div>;
  if (!safeData) return <div className="payment-shell"><div className="surface-card payment-empty">{error || "Could not load payment information."}<button type="button" className="btn btn-secondary" onClick={() => { setError(""); setLoading(true); void load().catch(e => setError(e instanceof Error ? e.message : "Unable to load payments.")).finally(() => setLoading(false)); }}>Retry</button></div></div>;
  return <div className="payment-shell">
    <div className="payment-section-head">
      <div><h2>Project payments</h2><p>Quotations, client receipts and founder settlements — all in INR.</p></div>
      <div className="payment-head-actions"><button type="button" className="btn btn-secondary" disabled={saving||holders.length<2} onClick={() => openForm("transfer")}><ArrowLeftRight size={16}/> Transfer</button><button type="button" className="btn btn-primary" disabled={saving||holders.length===0} onClick={() => openForm("receipt")}><Plus size={16}/> Record payment</button></div>
    </div>
    {message && <div className="payment-feedback success"><CheckCircle2 size={17}/>{message}<button type="button" aria-label="Dismiss" onClick={() => setMessage("")}><X size={15}/></button></div>}
    {error && <div className="payment-feedback error" role="alert">{error}<button type="button" aria-label="Dismiss" onClick={() => setError("")}><X size={15}/></button></div>}
    <div className="payment-metrics">
      <div className="payment-metric"><span>Project quotation</span><strong>{quote === null ? "Not set" : money(quote)}</strong><button type="button" onClick={editQuote}><PencilLine size={13}/> {quote === null ? "Set quotation" : "Edit quotation"}</button></div>
      <div className="payment-metric"><span>Received from client</span><strong className="payment-positive">{money(received)}</strong><small>{activeClientPayments.length} recorded payment{activeClientPayments.length === 1 ? "" : "s"}</small></div>
      <div className="payment-metric"><span>Yet to receive</span><strong className="payment-due">{quote === null ? "—" : money(due)}</strong><small>{quote === null ? "Set a quotation to calculate dues" : "Unpaid client balance"}</small></div>
      <div className="payment-metric"><span>Collection progress</span><strong>{quote === null ? "—" : quote === 0 ? "0%" : `${Math.round(Math.min(100, received * 100 / quote))}%`}</strong><div className="payment-progress"><span style={{ width: quote !== null && quote > 0 ? `${Math.min(100, received * 100 / quote)}%` : "0%" }}/></div></div>
    </div>
    {overpaid > 0 && <div className="payment-feedback warning"><CircleHelp size={16}/>Received exceeds the quotation by {money(overpaid)}. Check whether this is an advance or an extra charge.</div>}
    {quoteEditing && <Modal open={quoteEditing} onClose={() => { if (!saving) setQuoteEditing(false); }} title="Project quotation" subtitle="Set the total agreed price. Your outstanding balance will update automatically."><form className="payment-quote-modal" onSubmit={submitQuote}>{error && <div className="payment-feedback error" role="alert">{error}</div>}<div className="payment-inline-form"><label>Quotation (₹)<input autoFocus inputMode="decimal" type="text" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} placeholder="150000.00" required/></label><button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save amount"}</button><button type="button" disabled={saving} onClick={() => setQuoteEditing(false)} className="btn btn-secondary">Cancel</button></div></form></Modal>}
    <div className="payment-founder-grid">
      {holders.map(m => {const data=heldBy(m.id,receipts,transfers);return <div key={m.id} className="surface-card payment-founder-card"><div><span className="payment-founder-avatar">{m.name[0]}</span><div><strong>{m.name}</strong><small>Tracked money currently held</small></div></div><strong className="payment-founder-balance">{money(data.balance)}</strong><p>Client payments: {money(data.clients)}<span>Incoming transfers: {money(data.incoming)}</span><span>Outgoing transfers: {money(data.outgoing)}</span></p></div>;})}
    </div>
    <p className="payment-explainer"><ShieldCheck size={15}/> Founder balances show tracked collections and transfers, not profit shares or bank balances. Founder transfers never count as new client income.</p>
    {form && <Modal open={!!form} onClose={() => { if (!saving) closeForm(); }} title={form === "receipt" ? "Record client payment" : "Record founder transfer"} subtitle={form === "receipt" ? "Add the money actually received from the client." : "Track a payment between active admins or founders."} wide><div className="payment-modal-container">{error && <div className="payment-feedback error" role="alert">{error}</div>}<form onSubmit={submitEntry} className="payment-entry-form">
      <label>Amount (₹) *<input type="text" inputMode="decimal" placeholder="10000.00" required value={amount} onChange={e => editField(setAmount, e.target.value)}/></label>
      <label>Date and time *<input type="datetime-local" required value={date} max={currentLocalDatetime()} onChange={e => editField(setDate, e.target.value)}/></label>
      <label>Payment method *<select value={method} onChange={e => editField(setMethod, e.target.value)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></label>
      {form === "receipt" ? <label>Received by *<select value={receivedBy} onChange={e => {setReceivedBy(e.target.value as FounderName);requestId.current=null;}}>{holders.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label> : <><label>Sent by *<select value={fromFounder} onChange={e => {setFromFounder(e.target.value);setToFounder(holders.find(m=>m.id!==e.target.value)?.id||"");requestId.current=null;}}>{holders.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Received by *<select value={toFounder} required onChange={e=>{setToFounder(e.target.value);requestId.current=null;}}>{holders.filter(m=>m.id!==fromFounder).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>}
      <label>Reference / transaction ID<input value={reference} maxLength={150} onChange={e => editField(setReference,e.target.value)} placeholder="Optional reference"/></label>
      <label className="payment-wide">Note<textarea value={note} maxLength={1000} onChange={e => editField(setNote,e.target.value)} rows={2} placeholder="Optional details"/></label>
      <div className="payment-form-actions"><button className="btn btn-secondary" type="button" disabled={saving} onClick={closeForm}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : form === "receipt" ? "Save client payment" : "Save founder transfer"}</button></div>
    </form></div></Modal>}
    <div className="payment-ledgers">
      <section className="surface-card payment-ledger"><div className="payment-ledger-title"><div><ReceiptText size={18}/><h3>Client payments</h3><span>{receipts.length}</span></div><button type="button" onClick={() => setShowVoided(v => !v)}>{showVoided ? "Hide voided" : "Show all history"}</button></div>{receipts.filter(r => showVoided || !r.voidedAt).length ? <div className="payment-ledger-list">{receipts.filter(r => showVoided || !r.voidedAt).map(r => <article className={r.voidedAt ? "payment-ledger-item is-voided" : "payment-ledger-item"} key={r.id}><div className="payment-ledger-primary"><strong>{money(r.amountPaise)}</strong><span className="payment-method-tag">{r.method}</span>{r.voidedAt && <span className="payment-void-tag">Voided</span>}</div><div className="payment-ledger-meta">{transactionDate(r.paidAt)} · Received by {holders.find(m=>m.id===r.receivedBy)?.name||"Former team member"} · Added by {r.recordedBy}</div>{(r.reference || r.note) && <p>{r.reference ? `Ref: ${r.reference}` : ""}{r.reference && r.note ? " · " : ""}{r.note}</p>}{r.voidedAt && <p>Correction: {r.voidReason}</p>}{!r.voidedAt && <button type="button" disabled={saving} className="payment-void-action" onClick={() => void voidEntry("receipt",r)}>Correct / void entry</button>}</article>)}</div> : <div className="payment-empty"><ArrowDownLeft size={22}/>No client payments recorded yet.</div>}</section>
      <section className="surface-card payment-ledger"><div className="payment-ledger-title"><div><ArrowLeftRight size={18}/><h3>Founder transfers</h3><span>{transfers.length}</span></div><button type="button" onClick={() => setShowVoided(v => !v)}>{showVoided ? "Hide voided" : "Show all history"}</button></div>{transfers.filter(t => showVoided || !t.voidedAt).length ? <div className="payment-ledger-list">{transfers.filter(t => showVoided || !t.voidedAt).map(t => <article key={t.id} className={t.voidedAt ? "payment-ledger-item is-voided" : "payment-ledger-item"}><div className="payment-ledger-primary"><strong>{money(t.amountPaise)}</strong><span>{holders.find(m=>m.id===t.fromFounder)?.name||"Former member"} → {holders.find(m=>m.id===t.toFounder)?.name||"Former member"}</span>{t.voidedAt && <span className="payment-void-tag">Voided</span>}</div><div className="payment-ledger-meta">{transactionDate(t.transferredAt)} · {t.method} · Added by {t.recordedBy}</div>{(t.reference || t.note) && <p>{t.reference ? `Ref: ${t.reference}` : ""}{t.reference && t.note ? " · " : ""}{t.note}</p>}{t.voidedAt && <p>Correction: {t.voidReason}</p>}{!t.voidedAt && <button type="button" disabled={saving} className="payment-void-action" onClick={() => void voidEntry("transfer",t)}>Correct / void entry</button>}</article>)}</div> : <div className="payment-empty"><Banknote size={22}/>No founder transfers recorded yet.</div>}</section>
    </div>
  </div>;
}
