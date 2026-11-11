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

export async function authorize() {
  const {userId} = await auth();
  if (!userId) throw new AccessError('Please sign in.',401);
  const allowed = (process.env.ALLOWED_FOUNDER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length !== 2) throw new AccessError('Founder access has not been configured. Set ALLOWED_FOUNDER_EMAILS to the two authorized emails.',503);
  const clerkUser = await currentUser();
  const emails = clerkUser?.emailAddresses.map(e=>e.emailAddress.toLowerCase())||[];
  const email = emails.find(e=>allowed.includes(e));
  if (!email) throw new AccessError('This account is not an authorized founder.',403);
  const firstName = (clerkUser?.firstName||'').trim();
  const label = allowed.indexOf(email) === 0 ? 'Kabir' : 'Naushad';
  // Names are assigned by the order in ALLOWED_FOUNDER_EMAILS, independent of the Clerk display name.
  const sql = database();
  await sql`INSERT INTO users (id,email,display_name,avatar_url)
    VALUES (${userId},${email},${label},${clerkUser?.imageUrl||null})
    ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,
      avatar_url=EXCLUDED.avatar_url,updated_at=now()`;
  return {id:userId,email,name:label,displayName:firstName||label};
}

function valueDate(v:unknown):string { if(!v)return ''; if(v instanceof Date) return v.toISOString(); return String(v); }
function safeOwner(s:unknown):ProjectOwner { return s==='Kabir'||s==='Naushad' ? s:'Both'; }

export async function loadWorkspace(){
  await authorize();
  const sql=database();
  const [rows,notes,documents,activity]=await Promise.all([
    sql`SELECT p.*,h.reason AS current_hold_reason FROM projects p LEFT JOIN project_holds h
      ON h.project_id=p.id AND h.resumed_at IS NULL ORDER BY p.updated_at DESC`,
    sql`SELECT n.*,u.display_name AS author_name FROM project_notes n JOIN users u ON u.id=n.author_id ORDER BY n.created_at DESC`,
    sql`SELECT d.*,u.display_name AS author_name FROM project_documents d JOIN users u ON u.id=d.uploaded_by_id
      WHERE d.deleted_at IS NULL AND d.upload_status='ready' ORDER BY d.uploaded_at DESC`,
    sql`SELECT a.*,u.display_name AS author_name FROM activity_logs a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC`
  ]);
  const projects: Project[] = rows.map(r=>({
    id:r.id,code:`NVT-${String(r.project_number).padStart(4,'0')}`,name:r.name,description:r.description||'',
    type:r.type==='internal'?'Internal Product':'Client Project',client:r.client_name||'',
    status:dbToStatus[String(r.status)]||'Not Started',owner:safeOwner(r.owner_selection),
    progress:Number(r.progress),deadline:r.due_date||'',startedAt:valueDate(r.start_date)||valueDate(r.created_at),
    createdAt:valueDate(r.created_at),updatedAt:valueDate(r.updated_at),accent:'indigo',
    onHoldReason:r.current_hold_reason||undefined,archived:!!r.archived_at,
  }));
  const noteItems: ProjectNote[]=notes.map(r=>({id:r.id,projectId:r.project_id,author:r.author_name,content:r.body,createdAt:valueDate(r.created_at)}));
  const fileItems:ProjectDocument[]=documents.map(r=>({id:r.id,projectId:r.project_id,name:r.original_name,category:String(r.category).charAt(0).toUpperCase()+String(r.category).slice(1),bytes:r.size_bytes,uploadedBy:r.author_name,createdAt:valueDate(r.uploaded_at)}));
  const activities:ProjectActivity[]=activity.map(r=>({id:r.id,projectId:r.project_id,author:r.author_name,action:typeof r.details?.description==='string'?r.details.description:String(r.action).replaceAll('_',' '),createdAt:valueDate(r.created_at)}));
  return {projects,notes:noteItems,documents:fileItems,activity:activities};
}

export function errorResponse(error: unknown) {
 const status = error instanceof AccessError ? error.status : 500;
 const message = error instanceof AccessError ? error.message : error instanceof Error && error.message.startsWith('Validation:') ? error.message.slice(11) : 'Could not complete this request.';
 return Response.json({error:message},{status:message!== 'Could not complete this request.'&&status===500?400:status});
}
export function validate(condition:unknown,message:string): asserts condition { if(!condition) throw new Error(`Validation: ${message}`); }
export const validStatuses = Object.keys(statusToDb) as ProjectStatus[];
export const validOwners = ['Kabir','Naushad','Both'] as ProjectOwner[];
export function safeText(v:unknown,max:number=1000){validate(typeof v==='string' && v.length<=max,'Invalid text.');return v.trim();}
export function uuidCheck(v:unknown){validate(typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),'Invalid project identifier.');return v;}
