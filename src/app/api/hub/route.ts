import { authorize, database, errorResponse, projectTypes, safeText, statusToDb, uuidCheck, validate, validOwners, validStatuses, loadWorkspace } from '@/lib/server';
import type {ProjectStatus} from '@/lib/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const ok=(result:unknown)=>Response.json(result,{headers:{'Cache-Control':'no-store'}});
const allowedTypes=['Client Project','Internal Product'];

export async function GET(){try{return ok(await loadWorkspace());}catch(e){return errorResponse(e);}}

export async function POST(request:Request){
 try{
  const actor=await authorize();const sql=database();const data=await request.json();
  validate(data&&typeof data==='object','Invalid request.');
  if(data.action==='create'){
    const d=data.draft||{};
    const name=safeText(d.name,180),description=safeText(d.description||'',5000);
    const client=safeText(d.client||'',180);
    validate(name.length>0,'Project name required.');
    validate(allowedTypes.includes(d.type),'Invalid project type.');
    validate(validOwners.includes(d.owner),'Invalid founder assignment.');
    validate(validStatuses.includes(d.status) && d.status!=='On Hold','Invalid initial status.');
    const date=d.deadline||null;validate(!date||/^\d{4}-\d{2}-\d{2}$/.test(date),'Invalid deadline.');
    const type=projectTypes[d.type as keyof typeof projectTypes];
    const status=statusToDb[d.status as ProjectStatus];
    const progress=d.status==='Completed'?100:0;
    const row=await sql`INSERT INTO projects(name,description,type,client_name,status,owner_selection,progress,due_date,created_by_id,updated_by_id,completed_at)
      VALUES (${name},${description},${type},${type==='internal'?null:client},${status},${d.owner},${progress},${date},${actor.id},${actor.id},${d.status==='Completed'?new Date().toISOString():null}) RETURNING id`;
    const id=String(row[0].id);
    await sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${id},${actor.id},'project_created',${JSON.stringify({description:'Created the project'})}::jsonb)`;
    return ok({id});
  }
  if(data.action==='note'){
    const projectId=uuidCheck(data.projectId),body=safeText(data.body,10000);
    validate(body.length>0,'Note cannot be empty.');
    await sql`INSERT INTO project_notes (project_id,body,author_id)
      VALUES (${projectId},${body},${actor.id})`;
    await sql`INSERT INTO activity_logs(project_id,actor_id,action,details)
      VALUES (${projectId},${actor.id},'note_added',${JSON.stringify({description:'Added a project note'})}::jsonb)`;
    return ok({success:true});
  }
  return Response.json({error:'Unsupported action.'},{status:400});
 }catch(e){return errorResponse(e);}
}

export async function PATCH(request:Request){
 try{
  const actor=await authorize(),sql=database(),body=await request.json();
  const id=uuidCheck(body.id),values=body.values||{};
  validate(values && typeof values==='object' && !Array.isArray(values),'Invalid project update.');
  const rows=await sql`SELECT * FROM projects WHERE id=${id} LIMIT 1`;
  validate(rows.length===1,'Project not found.');
  const current=rows[0];
  let status=String(current.status),progress=Number(current.progress);
  let change='Updated project details';
  if(values.status!==undefined){
    validate(validStatuses.includes(values.status),'Invalid status.');
    status=statusToDb[values.status as ProjectStatus];
    if(status==='on_hold'&&current.status!=='on_hold'){
      validate(typeof body.reason==='string' && body.reason.trim().length>0&&body.reason.length<=5000,'An on-hold reason is required.');
      await sql`INSERT INTO project_holds (project_id,reason,previous_status,started_by_id)
        VALUES (${id},${body.reason.trim()},${String(current.status)},${actor.id})`;
    }
    if(status!=='on_hold'&&current.status==='on_hold'){
      await sql`UPDATE project_holds SET resumed_at=now(),resumed_by_id=${actor.id}
        WHERE project_id=${id} AND resumed_at IS NULL`;
    }
    change=`Changed status to ${values.status}`;
  }
  if(values.progress!==undefined){validate(Number.isInteger(values.progress)&&values.progress>=0&&values.progress<=100,'Progress must be between 0 and 100.');progress=values.progress;change=`Updated progress to ${progress}%`;}
  if(status==='completed')progress=100;
  if(values.archived!==undefined){validate(typeof values.archived==='boolean','Invalid archive value.');}
  const name=values.name!==undefined?safeText(values.name,180):String(current.name);validate(name,'Project name required.');
  const description=values.description!==undefined?safeText(values.description,5000):String(current.description||'');
  const type=values.type!==undefined?(validate(allowedTypes.includes(values.type),'Invalid type.'),projectTypes[values.type as keyof typeof projectTypes]):String(current.type);
  const client=values.client!==undefined?safeText(values.client,180):String(current.client_name||'');
  const owner=values.owner!==undefined?(validate(validOwners.includes(values.owner),'Invalid owner.'),values.owner):String(current.owner_selection);
  const deadline=values.deadline!==undefined?values.deadline||null:current.due_date;
  validate(!deadline||/^\d{4}-\d{2}-\d{2}$/.test(String(deadline)),'Invalid deadline.');
  const archived=values.archived===undefined?current.archived_at:(values.archived?new Date().toISOString():null);
  if(values.archived===true)change='Archived the project';if(values.archived===false)change='Restored the project';
  await sql`UPDATE projects SET name=${name},description=${description},type=${type}::project_type,
    client_name=${type==='internal'?null:client},owner_selection=${owner},status=${status}::project_status,
    progress=${progress},due_date=${deadline},archived_at=${archived},
    completed_at=${status==='completed'?(current.completed_at||new Date().toISOString()):null},
    updated_by_id=${actor.id},updated_at=now() WHERE id=${id}`;
  await sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${id},${actor.id},'project_updated',${JSON.stringify({description:change})}::jsonb)`;
  return ok({success:true});
 }catch(e){return errorResponse(e);}
}
