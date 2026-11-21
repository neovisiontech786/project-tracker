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
// Reject browser cross-site writes as an additional layer beyond Clerk's session cookies.
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // Non-browser clients are still authenticated at the API boundary.
  try {
    const from=new URL(origin), target=new URL(request.url);
    if(from.protocol !== target.protocol || from.host !== target.host) throw new Error('origin mismatch');
  }catch{
    throw new AccessError('Cross-origin modifications are not allowed.',403);
  }
}
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AccessError('DATABASE_URL is not configured.',503);
  return neon(url);
}
export const validStatuses = Object.keys(statusToDb) as ProjectStatus[];
export const validOwners = ['All'] as ProjectOwner[];
export function validate(condition:unknown,message:string): asserts condition { if(!condition) throw new Error(`Validation: ${message}`); }
export function safeText(v:unknown,max:number=1000){validate(typeof v==='string'&&v.length<=max,'Invalid text.');return v.trim();}
export function uuidCheck(v:unknown){validate(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),'Invalid project identifier.');return v;}

export type TeamRole = 'admin' | 'founder' | 'member';
export type TeamActor = { id: string; email: string; name: string; role: TeamRole };

export function isManager(actor:TeamActor) { return actor.role==='admin'||actor.role==='founder'; }
export function requireRole(actor:TeamActor,roles:readonly TeamRole[]) {
  if(!roles.includes(actor.role))throw new AccessError('You do not have permission for this action.',403);
}
export async function teamUsers(){
  const sql=database();
  return sql`SELECT id,display_name AS name,email,role,is_active AS active
     FROM users WHERE removed_at IS NULL AND is_active=true AND revoked_at IS NULL
     ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'founder' THEN 1 ELSE 2 END,display_name`;
}

// Never trust an email alone. A new account must claim a previously sent invitation
// with a verified address from Clerk. Suspensions and removals are never auto-cleared.
export async function authorize():Promise<TeamActor> {
  const {userId}=await auth();
  if(!userId)throw new AccessError('Please sign in.',401);
  const sql=database();
  const current=await sql`SELECT id,email,display_name,role,is_active,revoked_at,removed_at FROM users WHERE id=${userId} LIMIT 1`;
  if(current.length) {
    const u=current[0];
    if(u.removed_at)throw new AccessError('This account was removed from the workspace.',403);
    if(u.revoked_at)throw new AccessError('Workspace access is suspended. Contact an administrator.',403);
    if(u.is_active) return {id:userId,email:String(u.email),name:String(u.display_name),role:u.role as TeamRole};
  }
  const clerkUser=await currentUser();
  if(!clerkUser)throw new AccessError('Clerk could not verify this account.',401);
  const verified=clerkUser.emailAddresses.filter(e=>e.verification?.status==='verified')
    .map(e=>e.emailAddress.trim().toLowerCase());
  if(!verified.length)throw new AccessError('Verify your email address to accept the invitation.',403);
  const invitation=await sql`SELECT id,email,display_name,role
    FROM team_invitations WHERE email=ANY(${verified}) AND status='sent'
    ORDER BY created_at DESC LIMIT 1`;
  if(!invitation.length)throw new AccessError('No active workspace invitation for this email. Ask an administrator to invite you.',403);
  const invite=invitation[0];
  const conflicting=await sql`SELECT id,removed_at,revoked_at FROM users WHERE email=${invite.email} AND id<>${userId} LIMIT 1`;
  if(conflicting.length)throw new AccessError('This email belongs to another workspace account. Contact an administrator.',403);
  // Lock and consume the invitation in the same SQL statement as activation.
  // A simultaneous revoke or second account claim cannot activate an uninvited user.
  const claimed=await sql`
    WITH invite AS (
      SELECT id,email,display_name,role FROM team_invitations
      WHERE id=${invite.id} AND status='sent' FOR UPDATE
    ), activated AS (
      INSERT INTO users(id,email,display_name,avatar_url,role,is_active,revoked_at,removed_at)
        SELECT ${userId},email,display_name,${clerkUser.imageUrl||null},role,true,null,null FROM invite
      ON CONFLICT(id) DO UPDATE SET
        email=EXCLUDED.email,display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,
        role=EXCLUDED.role,is_active=true,updated_at=now()
      WHERE users.revoked_at IS NULL AND users.removed_at IS NULL
      RETURNING id
    ), accepted AS (
      UPDATE team_invitations SET status='accepted',accepted_by_id=${userId},updated_at=now()
      WHERE id IN (SELECT id FROM invite) AND EXISTS(SELECT id FROM activated)
      RETURNING id
    ) SELECT id FROM accepted`;
  if(!claimed.length)throw new AccessError('This invitation has already been used or revoked.',409);
  await sql`INSERT INTO founder_access_events(actor_id,subject_id,action,details)
    VALUES (${userId},${userId},'team_invitation_accepted',jsonb_build_object('role',${invite.role}))`;
  const active=await sql`SELECT role,display_name FROM users WHERE id=${userId} AND is_active=true AND revoked_at IS NULL AND removed_at IS NULL`;
  if(!active.length)throw new AccessError('Your invitation cannot activate this account.',403);
  await sql`INSERT INTO project_members(project_id,user_id)
    SELECT p.id,${userId} FROM projects p WHERE p.is_private=false
      AND (p.owner_selection=${userId} OR (p.owner_selection='All' AND ${active[0].role} IN ('admin','founder')))
    ON CONFLICT DO NOTHING`;
  return {id:userId,email:String(invite.email),name:String(active[0].display_name),role:active[0].role as TeamRole};
}

// Assignment is a responsibility label; permissions are always re-evaluated
// from active roles and the current project's visibility.
export async function syncProjectMemberships(projectId:string){
  const sql=database();
  await sql.transaction([
    sql`DELETE FROM project_members WHERE project_id=${projectId}`,
    sql`INSERT INTO project_members(project_id,user_id)
      SELECT p.id,u.id FROM projects p JOIN users u
       ON u.is_active=true AND u.revoked_at IS NULL AND u.removed_at IS NULL
       AND (
        (p.is_private=true AND p.created_by_id=u.id) OR
        (p.is_private=false AND (
           u.role IN ('admin','founder') OR
           p.owner_selection=u.id
        ))
       )
      WHERE p.id=${projectId} ON CONFLICT DO NOTHING`
  ]);
}
export async function accessibleProject(projectId:string,actor:TeamActor){
  const sql=database();
  const rows=await sql`SELECT p.*,p.xmin::text AS row_version FROM projects p WHERE p.id=${projectId}
    AND (p.created_by_id=${actor.id} OR
      (p.is_private=false AND (${actor.role} IN ('admin','founder') OR p.owner_selection=${actor.id})))
    LIMIT 1`;
  if(!rows.length)throw new AccessError('Project not found or not accessible.',404);
  return rows[0];
}
function valueDate(v:unknown):string {if(!v)return '';if(v instanceof Date)return v.toISOString();return String(v);}
function safeOwner(s:unknown):ProjectOwner {return typeof s==='string'?s:'All';}

export async function loadWorkspace(){
  const actor=await authorize();
  const sql=database();
  const [rows,notes,documents,activity,members]=await Promise.all([
    sql`SELECT p.*,h.reason AS current_hold_reason FROM projects p
      LEFT JOIN project_holds h ON h.project_id=p.id AND h.resumed_at IS NULL
      WHERE (p.created_by_id=${actor.id} OR (p.is_private=false AND (${actor.role} IN ('admin','founder') OR p.owner_selection=${actor.id}))) ORDER BY p.updated_at DESC`,
    sql`SELECT n.*,u.display_name AS author_name FROM project_notes n
      JOIN users u ON u.id=n.author_id JOIN projects p ON p.id=n.project_id
      WHERE (p.created_by_id=${actor.id} OR (p.is_private=false AND (${actor.role} IN ('admin','founder') OR p.owner_selection=${actor.id}))) ORDER BY n.created_at DESC`,
    sql`SELECT d.*,u.display_name AS author_name FROM project_documents d
      JOIN users u ON u.id=d.uploaded_by_id JOIN projects p ON p.id=d.project_id
      WHERE d.deleted_at IS NULL AND d.upload_status='ready'
      AND (p.is_private=false OR p.created_by_id=${actor.id}) ORDER BY d.uploaded_at DESC`,
    sql`SELECT a.*,u.display_name AS author_name FROM activity_logs a
      JOIN users u ON u.id=a.actor_id JOIN projects p ON p.id=a.project_id
      WHERE (p.created_by_id=${actor.id} OR (p.is_private=false AND (${actor.role} IN ('admin','founder') OR p.owner_selection=${actor.id}))) ORDER BY a.created_at DESC`,
    teamUsers()
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
  return {viewerId:actor.id,viewerName:actor.name,viewerRole:actor.role,teamMembers:members,projects,notes:noteItems,documents:fileItems,activity:activities};
}
export function errorResponse(error:unknown){
  const status=error instanceof AccessError?error.status:500;
  const validation=error instanceof Error&&error.message.startsWith('Validation:');
  const message=error instanceof AccessError?error.message:validation?(error as Error).message.slice(11):'Could not complete this request.';
  if(status===500 && !validation)console.error('Project Hub API error:',error instanceof Error?error.message:'Unknown error');
  return Response.json({error:message},{status:validation?400:status,headers:{'Cache-Control':'no-store'}});
}
