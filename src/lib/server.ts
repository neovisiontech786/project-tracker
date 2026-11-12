import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import type { Project, ProjectNote, ProjectDocument, ProjectActivity, ProjectStatus, ProjectOwner } from './types';

const statusToDb: Record<ProjectStatus,string> = {
  'Not Started':'not_started', 'In Progress':'in_progress', 'On Hold':'on_hold',
  Completed:'completed', Cancelled:'cancelled'
};
const dbToStatus: Record<string,ProjectStatus> = Object.fromEntries(Object.entries(statusToDb).map(([k,v])=>[v,k as ProjectStatus])) as Record<string,ProjectStatus>;
const projectTypes = { 'Client Project':'client', 'Internal Product':'internal' } as const;
export { statusToDb, dbToStatus, projectTypes };

export class AccessError extends Error {
  constructor(message: string, public status: number = 403) { super(message); }
}
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AccessError('DATABASE_URL is not configured.',503);
  return neon(url);
}
export const validStatuses = Object.keys(statusToDb) as ProjectStatus[];
export const validOwners = ['Kabir','Naushad','Both'] as ProjectOwner[];
export function validate(condition:unknown,message:string): asserts condition { if(!condition) throw new Error(`Validation: ${message}`); }
export function safeText(v:unknown,max:number=1000){validate(typeof v==='string'&&v.length<=max,'Invalid text.');return v.trim();}
export function uuidCheck(v:unknown){validate(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),'Invalid project identifier.');return v;}

// Founder access uses Clerk ID for repeat logins. Email verification is required for
// first-time onboarding; other identities must be approved by Kabir from Settings.
export async function authorize() {
  const {userId} = await auth();
  if (!userId) throw new AccessError('Please sign in.',401);
  const sql=database();
  const existing=await sql`SELECT id,email,display_name,is_active FROM users WHERE id=${userId} LIMIT 1`;
  if(existing[0]?.is_active && ['Kabir','Naushad'].includes(String(existing[0].display_name))){
    return {id:userId,email:String(existing[0].email),name:String(existing[0].display_name) as 'Kabir'|'Naushad'};
  }

  const allowed=(process.env.ALLOWED_FOUNDER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length!==2 || allowed[0]===allowed[1]) throw new AccessError('Founder access configuration is incomplete.',503);
  const user=await currentUser();
  if(!user) throw new AccessError('Clerk could not load the signed-in user. Please sign out and sign in again.',401);

  const emails=user.emailAddresses||[];
  const verifiedEmails=emails.filter(e=>e.verification?.status==='verified').map(e=>e.emailAddress.trim().toLowerCase());
  const email=verifiedEmails.find(e=>allowed.includes(e));
  const displayedEmail=user.primaryEmailAddress?.emailAddress.trim().toLowerCase() || emails[0]?.emailAddress.trim().toLowerCase();
  if(!displayedEmail) throw new AccessError('Add a verified email address to your Clerk account.',403);

  if(email){
    const label: 'Kabir'|'Naushad' = allowed.indexOf(email)===0?'Kabir':'Naushad';
    // Never silently replace the identity of an already onboarded founder.
    const other=await sql`SELECT id FROM users WHERE email=${email} AND id<>${userId} LIMIT 1`;
    if(other.length)throw new AccessError('This founder email belongs to a different Clerk account. Contact Kabir to resolve it.',403);
    const occupied=await sql`SELECT id FROM users WHERE display_name=${label} AND is_active=true AND id<>${userId} LIMIT 1`;
    if(occupied.length)throw new AccessError('That founder seat already belongs to another account. Contact Kabir.',403);
    await sql`INSERT INTO users(id,email,display_name,avatar_url,is_active)
      VALUES (${userId},${email},${label},${user.imageUrl||null},true)
      ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name,
        avatar_url=EXCLUDED.avatar_url,is_active=true,updated_at=now()`;
    await syncFounderMemberships(userId,label);
    return {id:userId,email,name:label};
  }

  // Store a limited pending-access request without granting any project access.
  const name=[user.firstName,user.lastName].filter(Boolean).join(' ').trim() || 'New account';
  const pending=await sql`SELECT id FROM users WHERE email=${displayedEmail} AND id<>${userId} LIMIT 1`;
  if(pending.length)throw new AccessError('This email belongs to a different Clerk account. Please use your original sign-in.',403);
  await sql`INSERT INTO users(id,email,display_name,avatar_url,is_active)
    VALUES (${userId},${displayedEmail},${name.slice(0,120)},${user.imageUrl||null},false)
    ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,avatar_url=EXCLUDED.avatar_url,updated_at=now()
    WHERE users.is_active=false`;
  throw new AccessError(`Founder access pending for ${displayedEmail}. Ask Kabir to review the request in Settings, or sign in with your approved email.`,403);
}

// Assignments are not a visibility boundary: shared projects remain visible to both
// founders. This table records responsibility only.
export async function syncProjectMemberships(projectId:string){
  const sql=database();
  await sql`DELETE FROM project_members WHERE project_id=${projectId}`;
  await sql`INSERT INTO project_members(project_id,user_id)
    SELECT p.id,u.id FROM projects p JOIN users u ON u.is_active=true
      AND u.display_name IN ('Kabir','Naushad')
      AND (p.owner_selection='Both' OR p.owner_selection=u.display_name)
      AND (p.is_private=false OR p.created_by_id=u.id)
    WHERE p.id=${projectId} ON CONFLICT DO NOTHING`;
}
export async function syncFounderMemberships(userId:string,label:'Kabir'|'Naushad'){
  const sql=database();
  await sql`INSERT INTO project_members(project_id,user_id)
    SELECT p.id,${userId} FROM projects p
    WHERE (p.owner_selection='Both' OR p.owner_selection=${label})
      AND (p.is_private=false OR p.created_by_id=${userId})
    ON CONFLICT DO NOTHING`;
}
export async function accessibleProject(projectId:string,actorId:string){
  const sql=database();
  const rows=await sql`SELECT * FROM projects WHERE id=${projectId}
    AND (is_private=false OR created_by_id=${actorId}) LIMIT 1`;
  if(rows.length!==1)throw new AccessError('Project not found or not accessible.',404);
  return rows[0];
}
function valueDate(v:unknown):string {if(!v)return '';if(v instanceof Date)return v.toISOString();return String(v);}
function safeOwner(s:unknown):ProjectOwner {return s==='Kabir'||s==='Naushad'?s:'Both';}

export async function loadWorkspace(){
  const actor=await authorize();
  const sql=database();
  const [rows,notes,documents,activity]=await Promise.all([
    sql`SELECT p.*,h.reason AS current_hold_reason FROM projects p
      LEFT JOIN project_holds h ON h.project_id=p.id AND h.resumed_at IS NULL
      WHERE (p.is_private=false OR p.created_by_id=${actor.id}) ORDER BY p.updated_at DESC`,
    sql`SELECT n.*,u.display_name AS author_name FROM project_notes n
      JOIN users u ON u.id=n.author_id JOIN projects p ON p.id=n.project_id
      WHERE (p.is_private=false OR p.created_by_id=${actor.id}) ORDER BY n.created_at DESC`,
    sql`SELECT d.*,u.display_name AS author_name FROM project_documents d
      JOIN users u ON u.id=d.uploaded_by_id JOIN projects p ON p.id=d.project_id
      WHERE d.deleted_at IS NULL AND d.upload_status='ready'
      AND (p.is_private=false OR p.created_by_id=${actor.id}) ORDER BY d.uploaded_at DESC`,
    sql`SELECT a.*,u.display_name AS author_name FROM activity_logs a
      JOIN users u ON u.id=a.actor_id JOIN projects p ON p.id=a.project_id
      WHERE (p.is_private=false OR p.created_by_id=${actor.id}) ORDER BY a.created_at DESC`
  ]);
  const projects:Project[]=rows.map(r=>({
    id:r.id,code:`NVT-${String(r.project_number).padStart(4,'0')}`,name:r.name,description:r.description||'',
    type:r.type==='internal'?'Internal Product':'Client Project',client:r.client_name||'',
    status:dbToStatus[String(r.status)]||'Not Started',owner:safeOwner(r.owner_selection),
    progress:Number(r.progress),deadline:r.due_date||'',startedAt:valueDate(r.start_date)||valueDate(r.created_at),
    createdAt:valueDate(r.created_at),updatedAt:valueDate(r.updated_at),accent:'indigo',
    onHoldReason:r.current_hold_reason||undefined,archived:!!r.archived_at,
    isPrivate:Boolean(r.is_private),isCreator:r.created_by_id===actor.id,
  }));
  const noteItems:ProjectNote[]=notes.map(r=>({id:r.id,projectId:r.project_id,author:r.author_name,content:r.body,createdAt:valueDate(r.created_at)}));
  const fileItems:ProjectDocument[]=documents.map(r=>({id:r.id,projectId:r.project_id,name:r.original_name,category:String(r.category).charAt(0).toUpperCase()+String(r.category).slice(1),bytes:r.size_bytes,uploadedBy:r.author_name,createdAt:valueDate(r.uploaded_at)}));
  const activities:ProjectActivity[]=activity.map(r=>({id:r.id,projectId:r.project_id,author:r.author_name,action:typeof r.details?.description==='string'?r.details.description:String(r.action).replaceAll('_',' '),createdAt:valueDate(r.created_at)}));
  return {viewerName:actor.name,projects,notes:noteItems,documents:fileItems,activity:activities};
}
export function errorResponse(error:unknown){
  const status=error instanceof AccessError?error.status:500;
  const validation=error instanceof Error&&error.message.startsWith('Validation:');
  const message=error instanceof AccessError?error.message:validation?(error as Error).message.slice(11):'Could not complete this request.';
  if(status===500 && !validation)console.error('Project Hub API error:',error instanceof Error?error.message:'Unknown error');
  return Response.json({error:message},{status:validation?400:status,headers:{'Cache-Control':'no-store'}});
}
