"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, CheckCircle2, CircleDollarSign, IndianRupee, ReceiptText, Wallet } from "lucide-react";
import { useHub } from "@/lib/project-store";
import {
  activeReceipts, activeTransfers, duePaise, financeRequest, heldBy,
  money, sumPaise, transactionDate, type FinancePayload,
} from "@/lib/finance";

export default function PaymentsPage() {
  const { projects, ready, viewerName } = useHub();
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setError("");
    financeRequest<FinancePayload>("/api/payments")
      .then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load payments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [viewerName]);
  const visibleProjects = projects; // Financial history includes completed and archived projects.
  const financials = data?.finance || [];
  const receipts = activeReceipts(data?.receipts || []);
  const transfers = activeTransfers(data?.transfers || []);
  const quoteByProject = new Map(financials.map(f => [f.projectId, f.quotedPaise]));
  const receivedByProject = new Map<string, number>();
  receipts.forEach(r => receivedByProject.set(r.projectId, (receivedByProject.get(r.projectId) || 0) + r.amountPaise));
  const quoteTotal = visibleProjects.reduce((s, p) => s + (quoteByProject.get(p.id) || 0), 0);
  const receivedTotal = sumPaise(receipts.filter(r => visibleProjects.some(p => p.id === r.projectId)));
  const dueTotal = visibleProjects.reduce((s, p) => s + duePaise(quoteByProject.get(p.id) ?? null, receivedByProject.get(p.id) || 0), 0);
  const unquoted = visibleProjects.filter(p => quoteByProject.get(p.id) === null || quoteByProject.get(p.id) === undefined).length;
  const kabir = heldBy("Kabir", receipts, transfers);
  const naushad = heldBy("Naushad", receipts, transfers);
  const latest = [...receipts].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()).slice(0, 6);

  return <div className="page-container payments-overview">
    <div className="page-heading payment-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>PROJECT FINANCES</div><h1>Payments &amp; Collections</h1><p>Quotations, client receipts, outstanding dues and founder settlements.</p></div><span className="payment-workspace-tag">₹ INR · Projects visible to you</span></div>
    {(loading || !ready) && <div className="surface-card payment-empty">Loading your finance dashboard…</div>}
    {error && <div className="payment-feedback error" role="alert">{error}</div>}
    {data && ready && <>
      <div className="payment-summary-grid">
        {[
          {label:"Total quoted",amount:quoteTotal,Icon:CircleDollarSign,help:`Across ${visibleProjects.length} active project(s)`},
          {label:"Received from clients",amount:receivedTotal,Icon:ArrowDownLeft,help:`${receipts.length} recorded client payments`},
          {label:"Yet to receive",amount:dueTotal,Icon:Wallet,help:"Remaining amounts on quoted projects"},
          {label:"Founder transfers",amount:sumPaise(transfers),Icon:ArrowLeftRight,help:"Internal transfers, not extra income"},
        ].map(x => <div key={x.label} className="surface-card payment-summary-card"><div className="payment-summary-label"><span>{x.label}</span><x.Icon size={19}/></div><strong>{money(x.amount)}</strong><small>{x.help}</small></div>)}
      </div>
      <div className="payment-overview-columns">
        <section className="surface-card payment-overview-projects">
          <div className="payment-ledger-title"><div><ReceiptText size={18}/><h2>Project-wise payment status</h2></div><span>{visibleProjects.length} projects</span></div>
          {unquoted > 0 && <p className="payment-overview-note">{unquoted} project(s) don’t have a quotation yet. Set one inside each project’s Payments tab to calculate dues.</p>}
          {visibleProjects.length ? <div className="payment-project-table-scroll"><table className="payment-project-table"><thead><tr><th>PROJECT</th><th>QUOTATION</th><th>RECEIVED</th><th>REMAINING</th><th></th></tr></thead><tbody>{visibleProjects.map(p => {const q=quoteByProject.get(p.id) ?? null,received=receivedByProject.get(p.id) || 0;return <tr key={p.id}><td><Link href={`/projects/${p.id}?tab=payments`} className="payment-project-link"><strong>{p.name}</strong><small>{p.client || p.type}{p.archived?" · Archived":""}{p.isPrivate?" · Private":""}</small></Link></td><td>{q === null ? <span className="payment-not-set">Not set</span> : money(q)}</td><td className="payment-positive">{money(received)}</td><td className="payment-due">{q === null ? "—" : money(duePaise(q,received))}</td><td><Link className="payment-table-action" href={`/projects/${p.id}?tab=payments`} aria-label={`View payments for ${p.name}`}><ArrowRight size={17}/></Link></td></tr>})}</tbody></table></div> : <div className="payment-empty">Create a project first to start tracking payments.</div>}
        </section>
        <aside className="payment-overview-aside">
          <section className="surface-card payment-aside-card"><div className="payment-ledger-title"><div><IndianRupee size={18}/><h2>Founder balances</h2></div></div><p className="payment-aside-copy">Tracked amounts currently held, after transfers between founders.</p><div className="payment-founder-mini"><div><span className="payment-founder-avatar">K</span><span>Kabir</span><strong>{money(kabir.balance)}</strong></div><div><span className="payment-founder-avatar">N</span><span>Naushad</span><strong>{money(naushad.balance)}</strong></div></div><p className="payment-overview-note">These are recorded collections minus transfers, not profits or bank balances.</p></section>
          <section className="surface-card payment-aside-card"><div className="payment-ledger-title"><div><CheckCircle2 size={18}/><h2>Recent client payments</h2></div></div>{latest.length?latest.map(r=>{const p=projects.find(p=>p.id===r.projectId);return <Link key={r.id} className="payment-recent-row" href={`/projects/${r.projectId}?tab=payments`}><span><strong>{p?.name || "Project"}</strong><small>{transactionDate(r.paidAt)} · {r.method} · {r.receivedBy}</small></span><b>{money(r.amountPaise)}</b></Link>}):<div className="payment-empty">No payments have been recorded yet.</div>}</section>
        </aside>
      </div>
    </>}
  </div>;
}
