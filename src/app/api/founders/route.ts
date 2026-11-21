import { authorize, database, errorResponse, AccessError, validate } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireKabir() {
  const actor = await authorize();
  if(actor.name !== 'Kabir') throw new AccessError('Only Kabir can approve the second founder account.',403);
  return actor;
}

// Only a verified Kabir session can inspect pending access requests.
export async function GET() {
  try {
    await requireKabir();
    const sql = database();
    const pending = await sql`SELECT id, email, display_name, created_at FROM users
      WHERE is_active=false ORDER BY created_at DESC LIMIT 25`;
    const members = await sql`SELECT email, display_name FROM users
      WHERE is_active=true AND display_name IN ('Kabir','Naushad') ORDER BY display_name`;
    return Response.json({pending,members},{headers:{'Cache-Control':'no-store'}});
  } catch(e) { return errorResponse(e); }
}

// Approval binds the second founder seat to the exact Clerk user ID, without
// permitting arbitrary public sign-ups or requiring an unrestricted email list.
export async function POST(request:Request) {
  try {
    const actor=await requireKabir();
    const body = await request.json();
    validate(body && body.action==='approve' && typeof body.userId==='string' && /^user_[a-zA-Z0-9]{8,80}$/.test(body.userId),'Invalid request.');
    const sql=database();
    const pending=await sql`SELECT id,email FROM users WHERE id=${body.userId} AND is_active=false LIMIT 1`;
    if(pending.length!==1)throw new AccessError('The pending request was not found or was already approved.',404);
    const occupied=await sql`SELECT id FROM users
      WHERE display_name='Naushad' AND is_active=true LIMIT 1`;
    if(occupied.length)throw new AccessError('The Naushad founder account is already active.',409);
    // Atomic approval: either the founder, memberships and audit event all persist, or none do.
    await sql.transaction([
      sql`UPDATE users SET display_name='Naushad',is_active=true,updated_at=now()
        WHERE id=${body.userId} AND is_active=false`,
      sql`INSERT INTO project_members(project_id,user_id)
        SELECT p.id,${body.userId} FROM projects p
        WHERE (p.owner_selection='Both' OR p.owner_selection='Naushad')
          AND (p.is_private=false OR p.created_by_id=${body.userId})
        ON CONFLICT DO NOTHING`,
      sql`INSERT INTO founder_access_events(actor_id,subject_id,action,details)
        VALUES (${actor.id},${body.userId},'manual_approval',jsonb_build_object('role','Naushad'))`
    ]);
    return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return errorResponse(e);}
}
