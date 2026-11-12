import { randomUUID } from 'node:crypto';
import {
  authorize, accessibleProject, database, errorResponse, AccessError, projectTypes,
  safeText, statusToDb, uuidCheck, validate, validOwners, validStatuses,
  loadWorkspace, syncProjectMemberships
} from '@/lib/server';
import type {ProjectStatus} from '@/lib/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const ok=(result:unknown)=>Response.json(result,{headers:{'Cache-Control':'no-store'}});
const allowedTypes=['Client Project','Internal Product'];

export async function GET(){
  try {return ok(await loadWorkspace());} catch(e) {return errorResponse(e);}
}
export async function POST(request:Request){
 try{
  const actor=await authorize(),sql=database(),data=await request.json();
  validate(data && typeof data==='object' && !Array.isArray(data),'Invalid request.');
  if(data.action==='create'){
    const d=data.draft||{};
    const name=safeText(d.name,180),description=safeText(d.description||'',5000);
    const client=safeText(d.client||'',180);
    validate(name.length>0,'Project name is required.');
    validate(allowedTypes.includes(d.type),'Invalid project type.');
    validate(validOwners.includes(d.owner),'Invalid founder assignment.');
    validate(validStatuses.includes(d.status) && d.status!=='On Hold','Invalid initial status.');
    validate(d.isPrivate===undefined || typeof d.isPrivate==='boolean','Invalid privacy setting.');
    const isPrivate=d.isPrivate===true;
    if(isPrivate && d.owner!==actor.name)throw new AccessError('Private projects can only be assigned to yourself. Change visibility to Shared to assign another founder.',400);
    const dueDate=d.deadline||null;
    validate(!dueDate||/^\d{4}-\d{2}-\d{2}$/.test(dueDate),'Invalid deadline.');
    const id=randomUUID(),type=projectTypes[d.type as keyof typeof projectTypes];
    const status=statusToDb[d.status as ProjectStatus];
    const progress=d.status==='Completed'?100:0;
    await sql.transaction([
      sql`INSERT INTO projects(id,name,description,type,client_name,status,owner_selection,progress,due_date,created_by_id,updated_by_id,completed_at,is_private)
        VALUES (${id},${name},${description},${type},${type==='internal'?null:client},${status},${d.owner},
        ${progress},${dueDate},${actor.id},${actor.id},${status==='completed'?new Date().toISOString():null},${isPrivate})`,
      sql`INSERT INTO activity_logs(project_id,actor_id,action,details)
        VALUES (${id},${actor.id},'project_created',${JSON.stringify({description:isPrivate?'Created a private project':'Created a shared project'})}::jsonb)`
    ]);
    await syncProjectMemberships(id);
    return ok({id});
  }
  if(data.action==='note'){
    const projectId=uuidCheck(data.projectId),body=safeText(data.body,10000);
    validate(body.length>0,'Note cannot be empty.');
    await accessibleProject(projectId,actor.id);
    await sql.transaction([
      sql`INSERT INTO project_notes (project_id,body,author_id) VALUES (${projectId},${body},${actor.id})`,
      sql`INSERT INTO activity_logs(project_id,actor_id,action,details)
        VALUES (${projectId},${actor.id},'note_added',${JSON.stringify({description:'Added a project note'})}::jsonb)`
    ]);
    return ok({success:true});
  }
  return Response.json({error:'Unsupported action.'},{status:400});
 }catch(e){return errorResponse(e);}
}
export async function PATCH(request:Request){
 try{
  const actor=await authorize(),sql=database(),body=await request.json();
  validate(body&&typeof body==='object'&&!Array.isArray(body),'Invalid update.');
  const id=uuidCheck(body.id),values=body.values||{};
  validate(values&&typeof values==='object'&&!Array.isArray(values),'Invalid project update.');
  const current=await accessibleProject(id,actor.id);
  let status=String(current.status),progress=Number(current.progress);
  let change='Updated project details';
  const holdQueries:ReturnType<typeof sql>[]=[];
  if(values.status!==undefined){
    validate(validStatuses.includes(values.status),'Invalid status.');
    status=statusToDb[values.status as ProjectStatus];
    if(status==='on_hold'&&current.status!=='on_hold'){
      validate(typeof body.reason==='string' && body.reason.trim().length>0 && body.reason.length<=5000,'An on-hold reason is required.');
      holdQueries.push(sql`INSERT INTO project_holds(project_id,reason,previous_status,started_by_id)
        VALUES (${id},${body.reason.trim()},${String(current.status)}::project_status,${actor.id})`);
    }
    if(status!=='on_hold'&&current.status==='on_hold'){
      holdQueries.push(sql`UPDATE project_holds SET resumed_at=now(),resumed_by_id=${actor.id}
        WHERE project_id=${id} AND resumed_at IS NULL`);
    }
    change=`Changed status to ${values.status}`;
  }
  if(values.progress!==undefined){
    validate(Number.isInteger(values.progress)&&values.progress>=0&&values.progress<=100,'Progress must be between 0 and 100.');
    progress=values.progress;change=`Updated progress to ${progress}%`;
  }
  if(status==='completed')progress=100;
  if(values.archived!==undefined)validate(typeof values.archived==='boolean','Invalid archive value.');
  const name=values.name!==undefined?safeText(values.name,180):String(current.name);
  validate(name.length>0,'Project name is required.');
  const description=values.description!==undefined?safeText(values.description,5000):String(current.description||'');
  const type=values.type!==undefined?(validate(allowedTypes.includes(values.type),'Invalid type.'),projectTypes[values.type as keyof typeof projectTypes]):String(current.type);
  const client=values.client!==undefined?safeText(values.client,180):String(current.client_name||'');
  const owner=values.owner!==undefined?(validate(validOwners.includes(values.owner),'Invalid owner.'),values.owner):String(current.owner_selection);
  const deadline=values.deadline!==undefined?values.deadline||null:current.due_date;
  validate(!deadline||/^\d{4}-\d{2}-\d{2}$/.test(String(deadline)),'Invalid deadline.');

  if(values.isPrivate!==undefined){
    validate(typeof values.isPrivate==='boolean','Invalid privacy setting.');
    if(current.created_by_id!==actor.id)throw new AccessError('Only the project creator can change its privacy.',403);
  }
  const isPrivate=values.isPrivate===undefined?Boolean(current.is_private):values.isPrivate;
  if(isPrivate && owner!==actor.name)throw new AccessError('Private projects must be assigned to their creator. Choose Shared to assign the other founder.',400);
  const archived=values.archived===undefined?current.archived_at:(values.archived?new Date().toISOString():null);
  if(values.archived===true)change='Archived the project';
  if(values.archived===false)change='Restored the project';
  if(values.isPrivate!==undefined&&values.isPrivate!==Boolean(current.is_private))change=isPrivate?'Made project private':'Shared project with both founders';

  await sql.transaction([
    ...holdQueries,
    sql`UPDATE projects SET name=${name},description=${description},type=${type}::project_type,
      client_name=${type==='internal'?null:client},owner_selection=${owner},
      status=${status}::project_status,progress=${progress},due_date=${deadline},
      archived_at=${archived},is_private=${isPrivate},
      completed_at=${status==='completed'?(current.completed_at||new Date().toISOString()):null},
      updated_by_id=${actor.id},updated_at=now() WHERE id=${id}`,
    sql`INSERT INTO activity_logs(project_id,actor_id,action,details)
      VALUES (${id},${actor.id},'project_updated',${JSON.stringify({description:change})}::jsonb)`
  ]);
  await syncProjectMemberships(id);
  return ok({success:true});
 }catch(e){return errorResponse(e);}
}
