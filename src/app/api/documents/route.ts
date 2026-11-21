import {randomUUID} from 'node:crypto';
import {authorize,accessibleProject,AccessError,database,errorResponse,uuidCheck,validate,assertSameOrigin,type TeamActor} from '@/lib/server';
import {confirmFile,removeFile,signDownload,signUpload} from '@/lib/storage';

export const runtime='nodejs';export const dynamic='force-dynamic';
const extensions:Record<string,string>={
 pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',zip:'application/zip'
};
const categories=['requirements','quotations','agreements','designs','other'];
async function getDocument(id:string, actor:TeamActor){
 const sql=database();const rows=await sql`SELECT d.* FROM project_documents d
   JOIN projects p ON p.id=d.project_id WHERE d.id=${id} AND d.deleted_at IS NULL
   AND (p.created_by_id=${actor.id} OR (p.is_private=false AND (${actor.role} IN ('admin','founder') OR p.owner_selection=${actor.id}))) LIMIT 1`;
 if(rows.length!==1)throw new AccessError('Document not found or not accessible.',404);
 return rows[0];
}
export async function GET(req:Request){
 try{const actor=await authorize();const id=uuidCheck(new URL(req.url).searchParams.get('id'));
  const d=await getDocument(id,actor);validate(d.upload_status==='ready','Document upload is incomplete.');
  const url=await signDownload(String(d.storage_key),String(d.original_name));
  return Response.json({url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await authorize(),sql=database(),input=await req.json();
  if(input.action==='prepare'){
   const projectId=uuidCheck(input.projectId);
   validate(typeof input.name==='string'&&input.name.length>0&&input.name.length<=255&& !/[\x00-\x1F]/.test(input.name),'Invalid filename.');
   const name=input.name as string,ext=name.split('.').pop()?.toLowerCase()||'';
   validate(!!extensions[ext],'Unsupported document type.');
   validate(Number.isInteger(input.size)&&input.size>0&&input.size<=20*1024*1024,'Maximum file size is 20 MB.');
   const category=String(input.category||'other').toLowerCase();validate(categories.includes(category),'Invalid category.');
   await accessibleProject(projectId,actor);
   const id=randomUUID(),key=`projects/${projectId}/${id}.${ext}`,mimeType=extensions[ext];
   const {url,headers}=await signUpload(key,mimeType);
   await sql`INSERT INTO project_documents (id,project_id,category,original_name,mime_type,size_bytes,storage_key,uploaded_by_id,upload_status)
    VALUES (${id},${projectId},${category}::document_category,${name},${mimeType},${input.size},${key},${actor.id},'pending')`;
   return Response.json({id,url,headers});
  }
  if(input.action==='complete'){
   const id=uuidCheck(input.id),doc=await getDocument(id,actor);
   validate(doc.uploaded_by_id===actor.id,'Only the uploader can finalize a document.');
   validate(doc.upload_status==='pending','Document has already been finalized.');
   const confirmed=await confirmFile(String(doc.storage_key),Number(doc.size_bytes),String(doc.mime_type),String(doc.original_name));
   validate(confirmed,'Uploaded document contents, MIME type or size do not match the expected file type.');
   await sql.transaction([
    sql`UPDATE project_documents SET upload_status='ready' WHERE id=${id}`,
    sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${doc.project_id},${actor.id},'document_uploaded',${JSON.stringify({description:`Uploaded ${doc.original_name}`})}::jsonb)`
   ]);
   return Response.json({success:true});
  }
  return Response.json({error:'Unsupported action.'},{status:400});
 }catch(e){return errorResponse(e);}
}
export async function DELETE(req:Request){
 try{
  assertSameOrigin(req);const actor=await authorize(),sql=database(),{id}=await req.json();const doc=await getDocument(uuidCheck(id),actor);
   if(actor.role==='member' && doc.uploaded_by_id!==actor.id)throw new AccessError('Members can only remove their own uploads.',403);
   // Revoke application access atomically before removing the storage object.
   await sql.transaction([
     sql`UPDATE project_documents SET deleted_at=now(),deleted_by_id=${actor.id} WHERE id=${id} AND deleted_at IS NULL`,
     sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${doc.project_id},${actor.id},'document_removed',${JSON.stringify({description:`Removed ${doc.original_name}`})}::jsonb)`
   ]);
   // An object-store outage must not make a deleted file accessible through the app.
   // Retain metadata for a future orphan-object cleanup if physical deletion fails.
   try { await removeFile(String(doc.storage_key)); }
   catch(e){ console.error('Document storage cleanup failed for',id,e instanceof Error?e.message:'Unknown storage error'); }
   return Response.json({success:true});
 }catch(e){return errorResponse(e);}
}
