import { authorize, accessibleProject, database, errorResponse, AccessError, safeText, uuidCheck, validate, assertSameOrigin, requireRole } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = ["Google Pay", "PhonePe", "Paytm", "UPI", "Bank Transfer", "Cash", "Card", "Other"] as const;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function amountInPaise(value: unknown, allowZero = false): number {
  validate(typeof value === "string" && /^\d{1,10}(?:\.\d{1,2})?$/.test(value), "Enter an amount in INR with up to two decimal places.");
  const [rupees, fraction = ""] = value.split(".");
  const amount = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  validate(Number.isSafeInteger(amount) && amount <= 100000000000 && (allowZero ? amount >= 0 : amount > 0), "Amount is outside the permitted range.");
  return amount;
}
function validMethod(value: unknown): string {
  validate(typeof value === "string" && METHODS.includes(value as typeof METHODS[number]), "Choose a valid payment method.");
  return value;
}
async function financeHolder(value: unknown): Promise<string> {
  validate(typeof value==='string' && /^user_[A-Za-z0-9]{8,80}$/.test(value),"Select a valid active founder.");
  const sql=database();
  const eligible=await sql`SELECT id FROM users WHERE id=${value}
    AND role IN ('admin','founder') AND is_active=true AND revoked_at IS NULL AND removed_at IS NULL LIMIT 1`;
  validate(eligible.length===1,"Select an active admin or founder.");
  return value;
}
function validTime(value: unknown): string {
  validate(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), "Enter a valid payment date and time.");
  const time = Date.parse(value);
  validate(Number.isFinite(time) && time >= Date.parse("2000-01-01T00:00:00.000Z") && time <= Date.now() + 300000, "The transaction date cannot be in the future.");
  return new Date(time).toISOString();
}
function optionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  const result = safeText(value, max);
  return result || null;
}
function integerAmount(value: unknown): number {
  const num = Number(value);
  validate(Number.isSafeInteger(num) && num >= 0, "Amount is outside the supported range.");
  return num;
}

export async function GET(request: Request) {
  try {
    const actor = await authorize();
    requireRole(actor,['admin','founder']);
    const selected = new URL(request.url).searchParams.get("projectId");
    if (selected) await accessibleProject(uuidCheck(selected), actor);
    const sql = database();
    // Private project finance is scoped to its creator, including records and totals.
    const [finance, receipts, transfers] = await Promise.all([
      sql`SELECT p.id AS project_id, f.quoted_paise, f.quoted_updated_at
          FROM projects p LEFT JOIN project_financials f ON f.project_id = p.id
          WHERE (p.is_private = false OR p.created_by_id = ${actor.id}) ORDER BY p.created_at`,
      sql`SELECT r.*, u.display_name AS recorded_by
          FROM client_receipts r JOIN projects p ON p.id = r.project_id
          JOIN users u ON u.id = r.recorded_by_id
          WHERE (p.is_private = false OR p.created_by_id = ${actor.id})
          ORDER BY r.paid_at DESC, r.created_at DESC`,
      sql`SELECT t.*, u.display_name AS recorded_by
          FROM founder_transfers t JOIN projects p ON p.id = t.project_id
          JOIN users u ON u.id = t.recorded_by_id
          WHERE (p.is_private = false OR p.created_by_id = ${actor.id})
          ORDER BY t.transferred_at DESC, t.created_at DESC`,
    ]);
    const keep = (projectId: unknown) => !selected || projectId === selected;
    return reply({
      finance: finance.filter(f => keep(f.project_id)).map(f => ({
        projectId: f.project_id,
        quotedPaise: f.quoted_paise === null || f.quoted_paise === undefined ? null : integerAmount(f.quoted_paise),
        updatedAt: f.quoted_updated_at || null,
      })),
      receipts: receipts.filter(r => keep(r.project_id)).map(r => ({
        id: r.id, projectId: r.project_id, amountPaise: integerAmount(r.amount_paise),
        paidAt: r.paid_at, method: r.method, receivedBy: r.received_by,
        reference: r.reference || "", note: r.note || "", recordedBy: r.recorded_by,
        createdAt: r.created_at, voidedAt: r.voided_at || null, voidReason: r.void_reason || null,
      })),
      transfers: transfers.filter(t => keep(t.project_id)).map(t => ({
        id: t.id, projectId: t.project_id, amountPaise: integerAmount(t.amount_paise),
        transferredAt: t.transferred_at, method: t.method, fromFounder: t.from_founder,
        toFounder: t.to_founder, reference: t.reference || "", note: t.note || "",
        recordedBy: t.recorded_by, createdAt: t.created_at, voidedAt: t.voided_at || null,
        voidReason: t.void_reason || null,
      })),
    });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await authorize();
    requireRole(actor,['admin','founder']);
    const data = await request.json();
    validate(data && typeof data === "object" && !Array.isArray(data), "Invalid payment request.");
    const projectId = uuidCheck(data.projectId);
    const project = await accessibleProject(projectId, actor);
    // Company financial records must remain visible to both founders.
    // Private projects can be shared before they receive company quotations or payments.
    if(project.is_private) throw new AccessError("Make this project shared before recording company financial transactions.",409);
    const sql = database();

    if (data.action === "quote") {
      const quotedPaise = amountInPaise(data.amount, true);
      const old = await sql`SELECT quoted_paise FROM project_financials WHERE project_id = ${projectId}`;
      const oldPaise = old.length && old[0].quoted_paise !== null ? Number(old[0].quoted_paise) : null;
      await sql.transaction([
        sql`INSERT INTO project_financials(project_id, quoted_paise, quoted_updated_by, quoted_updated_at)
          VALUES (${projectId}, ${quotedPaise}, ${actor.id}, now())
          ON CONFLICT(project_id) DO UPDATE SET quoted_paise = excluded.quoted_paise,
          quoted_updated_by = excluded.quoted_updated_by, quoted_updated_at = now()`,
        sql`INSERT INTO activity_logs(project_id,actor_id,action,details)
          VALUES (${projectId},${actor.id},'quotation_updated',
          ${JSON.stringify({ description: "Updated project quotation", oldPaise, newPaise: quotedPaise })}::jsonb)`,
      ]);
      return reply({ success: true });
    }

    if (data.action === "receipt" || data.action === "transfer") {
      const requestId = uuidCheck(data.requestId);
      const amount = amountInPaise(data.amount);
      const method = validMethod(data.method);
      const reference = optionalText(data.reference, 150);
      const note = optionalText(data.note, 1000);

      if (data.action === "receipt") {
        const receivedBy = await financeHolder(data.receivedBy);
        const paidAt = validTime(data.paidAt);
        const details = JSON.stringify({ description: "Recorded client payment", amountPaise: amount, method, receivedBy });
        const result = await sql`
          WITH inserted AS (
            INSERT INTO client_receipts(request_id,project_id,amount_paise,paid_at,method,received_by,reference,note,recorded_by_id)
            VALUES (${requestId},${projectId},${amount},${paidAt},${method},${receivedBy},${reference},${note},${actor.id})
            ON CONFLICT(request_id) DO NOTHING RETURNING id
          ), logged AS (
            INSERT INTO activity_logs(project_id,actor_id,action,details)
            SELECT ${projectId},${actor.id},'client_payment_recorded',${details}::jsonb FROM inserted RETURNING id
          ) SELECT id FROM inserted
        `;
        if (result.length === 0) {
          const existing = await sql`SELECT project_id,amount_paise,paid_at,method,received_by,reference,note,voided_at FROM client_receipts WHERE request_id=${requestId} LIMIT 1`;
          if (existing.length !== 1 || String(existing[0].project_id) !== projectId ||
              Number(existing[0].amount_paise) !== amount ||
              new Date(String(existing[0].paid_at)).getTime() !== new Date(paidAt).getTime() ||
              String(existing[0].method) !== method || String(existing[0].received_by) !== receivedBy ||
              (existing[0].reference ?? null) !== reference || (existing[0].note ?? null) !== note ||
              existing[0].voided_at !== null)
            throw new AccessError("This payment request ID was already used for another entry. Refresh the form and try again.", 409);
        }
        return reply({ success: true, idempotent: result.length === 0 });
      }

      const fromFounder = await financeHolder(data.fromFounder);
      const toFounder = await financeHolder(data.toFounder);
      validate(fromFounder !== toFounder, "A founder cannot transfer money to themselves.");
      const transferredAt = validTime(data.transferredAt);
      const details = JSON.stringify({ description: "Recorded founder-to-founder transfer", amountPaise: amount, fromFounder, toFounder, method });
      const result = await sql`
        WITH inserted AS (
          INSERT INTO founder_transfers(request_id,project_id,amount_paise,transferred_at,method,from_founder,to_founder,reference,note,recorded_by_id)
          VALUES (${requestId},${projectId},${amount},${transferredAt},${method},${fromFounder},${toFounder},${reference},${note},${actor.id})
          ON CONFLICT(request_id) DO NOTHING RETURNING id
        ), logged AS (
          INSERT INTO activity_logs(project_id,actor_id,action,details)
          SELECT ${projectId},${actor.id},'founder_transfer_recorded',${details}::jsonb FROM inserted RETURNING id
        ) SELECT id FROM inserted
      `;
      if (result.length === 0) {
        const existing = await sql`SELECT project_id,amount_paise,transferred_at,method,from_founder,to_founder,reference,note,voided_at FROM founder_transfers WHERE request_id=${requestId} LIMIT 1`;
        if (existing.length !== 1 || String(existing[0].project_id) !== projectId ||
            Number(existing[0].amount_paise) !== amount ||
            new Date(String(existing[0].transferred_at)).getTime() !== new Date(transferredAt).getTime() ||
            String(existing[0].method) !== method || String(existing[0].from_founder) !== fromFounder ||
            String(existing[0].to_founder) !== toFounder ||
            (existing[0].reference ?? null) !== reference || (existing[0].note ?? null) !== note ||
            existing[0].voided_at !== null)
          throw new AccessError("This transfer request ID was already used for another entry. Refresh the form and try again.",409);
      }
      return reply({ success: true, idempotent: result.length === 0 });
    }

    if (data.action === "void") {
      validate(data.kind === "receipt" || data.kind === "transfer", "Choose which transaction to void.");
      const id = uuidCheck(data.recordId);
      const reason = safeText(data.reason, 500);
      validate(reason.length >= 5, "Add a correction reason (at least 5 characters).");
      if (data.kind === "receipt") {
        const records = await sql`SELECT id,voided_at FROM client_receipts WHERE id=${id} AND project_id=${projectId}`;
        if (records.length !== 1) throw new AccessError("Payment record not found.", 404);
        if (records[0].voided_at) throw new AccessError("This payment is already voided.", 409);
        const details = JSON.stringify({ description: "Voided client payment", reason, recordId: id });
        const result = await sql`WITH changed AS (
          UPDATE client_receipts SET voided_at=now(),voided_by_id=${actor.id},void_reason=${reason}
          WHERE id=${id} AND project_id=${projectId} AND voided_at IS NULL RETURNING id
        ), logged AS (
          INSERT INTO activity_logs(project_id,actor_id,action,details)
          SELECT ${projectId},${actor.id},'client_payment_voided',${details}::jsonb FROM changed RETURNING id
        ) SELECT id FROM changed`;
        if (result.length !== 1) throw new AccessError("Payment record was already changed.", 409);
      } else {
        const records = await sql`SELECT id,voided_at FROM founder_transfers WHERE id=${id} AND project_id=${projectId}`;
        if (records.length !== 1) throw new AccessError("Transfer not found.", 404);
        if (records[0].voided_at) throw new AccessError("This transfer is already voided.", 409);
        const details = JSON.stringify({ description: "Voided founder transfer", reason, recordId: id });
        const result = await sql`WITH changed AS (
          UPDATE founder_transfers SET voided_at=now(),voided_by_id=${actor.id},void_reason=${reason}
          WHERE id=${id} AND project_id=${projectId} AND voided_at IS NULL RETURNING id
        ), logged AS (
          INSERT INTO activity_logs(project_id,actor_id,action,details)
          SELECT ${projectId},${actor.id},'founder_transfer_voided',${details}::jsonb FROM changed RETURNING id
        ) SELECT id FROM changed`;
        if (result.length !== 1) throw new AccessError("Transfer was already changed.", 409);
      }
      return reply({ success: true });
    }
    return reply({ error: "Unsupported payment action." }, 400);
  } catch (error) { return errorResponse(error); }
}
