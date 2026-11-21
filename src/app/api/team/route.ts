import { clerkClient } from '@clerk/nextjs/server';
import { authorize, database, errorResponse, AccessError, assertSameOrigin, validate, safeText, requireRole, type TeamRole } from '@/lib/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
const userId=(v:unknown)=>{validate(typeof v==='string'&&/^user_[A-Za-z0-9]{8,80}$/.test(v),'Invalid account ID.');return v as string;};
const role=(v:unknown):TeamRole=>{validate(v==='admin'||v==='founder'||v==='member','Select a valid role.');return v;};

export async function GET(){
 try{
  const actor=await authorize();requireRole(actor,['admin']);
  const sql=database();
  const [members,invitations]=await Promise.all([
    sql`SELECT id,display_name AS name,email,role,is_active AS active,
          revoked_at,removed_at,created_at FROM users ORDER BY created_at`,
    sql`SELECT id,email,display_name AS name,role,status,created_at
      FROM team_invitations WHERE status IN ('pending','sent','failed') ORDER BY created_at DESC`
  ]);
  return json({members,invitations,viewerId:actor.id});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{
  assertSameOrigin(request);
  const actor=await authorize();requireRole(actor,['admin']);
  const data=await request.json();validate(data&&typeof data==='object'&&!Array.isArray(data),'Invalid team request.');
  const sql=database();
  if(data.action==='invite'){
    const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
    validate(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=320,'Enter a valid email.');
    const name=safeText(data.name,120),newRole=role(data.role);
    validate(name.length>=2,'Enter a team member name.');
    const existing=await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`;
    if(existing.length)throw new AccessError('An account already uses this email. Edit its access instead.',409);
    const previous=await sql`SELECT id,status FROM team_invitations WHERE email=${email} LIMIT 1`;
    if(previous.length && previous[0].status==='sent')throw new AccessError('An invitation has already been sent to this address.',409);
    await sql`INSERT INTO team_invitations(email,display_name,role,invited_by_id,status)
      VALUES (${email},${name},${newRole},${actor.id},'pending')
      ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,
       role=EXCLUDED.role,invited_by_id=EXCLUDED.invited_by_id,status='pending',
       clerk_invitation_id=null,updated_at=now()`;
    try {
      const clerk=await clerkClient();
      const invitation=await clerk.invitations.createInvitation({
        emailAddress:email,
        redirectUrl:new URL('/sign-in',request.url).toString()
      });
      await sql`UPDATE team_invitations SET status='sent',clerk_invitation_id=${invitation.id},updated_at=now()
        WHERE email=${email} AND status='pending'`;
      return json({success:true});
    } catch(e) {
      await sql`UPDATE team_invitations SET status='failed',updated_at=now()
        WHERE email=${email} AND status='pending'`;
      throw new AccessError('Invitation email could not be sent. Check Clerk and retry.',502);
    }
  }
  if(data.action==='changeRole'||data.action==='suspend'||data.action==='activate'||data.action==='remove'){
    const targetId=userId(data.userId);
    const target=await sql`SELECT id,role,is_active,revoked_at,removed_at FROM users WHERE id=${targetId} LIMIT 1`;
    if(!target.length)throw new AccessError('Account not found.',404);
    if(target[0].removed_at)throw new AccessError('Removed accounts cannot be reactivated. Invite a new account.',409);
    if(targetId===actor.id && data.action!=='changeRole')throw new AccessError('You cannot suspend or remove your own account.',409);
    if(targetId===actor.id && data.action==='changeRole' && data.role!=='admin')throw new AccessError('You cannot downgrade your own admin account.',409);
    const otherAdmins=await sql`SELECT count(*)::int AS total FROM users WHERE role='admin'
       AND is_active=true AND revoked_at IS NULL AND removed_at IS NULL AND id<>${targetId}`;
    if(target[0].role==='admin' && Number(otherAdmins[0].total)===0 &&
       (data.action==='remove'||data.action==='suspend'||(data.action==='changeRole'&&data.role!=='admin')))
       throw new AccessError('The workspace must retain at least one active administrator.',409);
    if(data.action==='changeRole'){
      const next=role(data.role);
      await sql`UPDATE users SET role=${next},updated_at=now() WHERE id=${targetId}`;
    }else if(data.action==='suspend'){
      await sql`UPDATE users SET is_active=false,revoked_at=now(),updated_at=now()
        WHERE id=${targetId}`;
    }else if(data.action==='activate'){
      await sql`UPDATE users SET is_active=true,revoked_at=null,updated_at=now()
        WHERE id=${targetId} AND removed_at IS NULL`;
    }else{
      await sql`UPDATE users SET is_active=false,revoked_at=now(),removed_at=now(),updated_at=now()
        WHERE id=${targetId}`;
    }
    await sql`INSERT INTO founder_access_events(actor_id,subject_id,action,details)
      VALUES (${actor.id},${targetId},${data.action},
       jsonb_build_object('role',${data.action==='changeRole'?data.role:String(target[0].role)}))`;
    await sql`DELETE FROM project_members WHERE user_id=${targetId}`;
    if(data.action==='activate'||data.action==='changeRole'){
      await sql`INSERT INTO project_members(project_id,user_id)
        SELECT p.id,u.id FROM projects p JOIN users u ON u.id=${targetId}
        WHERE u.is_active=true AND u.revoked_at IS NULL AND u.removed_at IS NULL
          AND (p.created_by_id=u.id OR (p.is_private=false AND
           (u.role IN ('admin','founder') OR p.owner_selection=u.id)))
        ON CONFLICT DO NOTHING`;
    }
    return json({success:true});
  }
  if(data.action==='revokeInvite'){
    validate(typeof data.id==='string'&&/^[0-9a-f-]{36}$/i.test(data.id),'Invalid invitation.');
    const invites=await sql`UPDATE team_invitations SET status='revoked',updated_at=now()
      WHERE id=${data.id} AND status IN ('sent','pending','failed') RETURNING clerk_invitation_id`;
    if(!invites.length)throw new AccessError('Invitation no longer pending.',404);
    if(invites[0].clerk_invitation_id){
      const clerk=await clerkClient();
      try {await clerk.invitations.revokeInvitation(String(invites[0].clerk_invitation_id));}
      catch { /* Database authorization stays revoked even if the email link remains. */ }
    }
    return json({success:true});
  }
  return Response.json({error:'Unsupported team action.'},{status:400});
 }catch(e){return errorResponse(e);}
}
