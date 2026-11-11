import {randomUUID} from 'node:crypto';
import {authorize,database,errorResponse,uuidCheck,validate} from '@/lib/server';
import {confirmFile,removeFile,signDownload,signUpload} from '@/lib/storage';

export const runtime='nodejs';export const dynamic='force-dynamic';
const extensions:Record<string,string>={
 pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',zip:'application/zip'
};
const categories=['requirements','quotations','agreements','designs','other'];
async function getDocument(id:string){
 const sql=database();const rows=await sql`SELECT * FROM project_documents WHERE id=${id} AND deleted_at IS NULL LIMIT 1`;
 validate(rows.length===1,'Document not found.');return rows[0];
}
export async function GET(req:Request){
 try{await authorize();const id=uuidCheck(new URL(req.url).searchParams.get('id'));
  const d=await getDocument(id);validate(d.upload_status==='ready','Document upload is incomplete.');
  const url=await signDownload(String(d.storage_key),String(d.original_name));
  return Response.json({url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function POST(req:Request){
 try{
  const actor=await authorize(),sql=database(),input=await req.json();
  if(input.action==='prepare'){
   const projectId=uuidCheck(input.projectId);
   validate(typeof input.name==='string'&&input.name.length>0&&input.name.length<=255&& !/[\x00-\x1F]/.test(input.name),'Invalid filename.');
   const name=input.name as string,ext=name.split('.').pop()?.toLowerCase()||'';
   validate(!!extensions[ext],'Unsupported document type.');
   validate(Number.isInteger(input.size)&&input.size>0&&input.size<=20*1024*1024,'Maximum file size is 20 MB.');
   const category=String(input.category||'other').toLowerCase();validate(categories.includes(category),'Invalid category.');
   const exists=await sql`SELECT 1 FROM projects WHERE id=${projectId} LIMIT 1`;validate(exists.length>0,'Project not found.');
   const id=randomUUID(),key=`projects/${projectId}/${id}.${ext}`,mimeType=extensions[ext];
   const {url,headers}=await signUpload(key,mimeType);
   await sql`INSERT INTO project_documents (id,project_id,category,original_name,mime_type,size_bytes,storage_key,uploaded_by_id,upload_status)
    VALUES (${id},${projectId},${category}::document_category,${name},${mimeType},${input.size},${key},${actor.id},'pending')`;
   return Response.json({id,url,headers});
  }
  if(input.action==='complete'){
   const id=uuidCheck(input.id),doc=await getDocument(id);
   validate(doc.upload_status==='pending','Document has already been finalized.');
   const confirmed=await confirmFile(String(doc.storage_key),Number(doc.size_bytes));
   validate(confirmed,'Uploaded document size does not match the original request.');
   await sql`UPDATE project_documents SET upload_status='ready' WHERE id=${id}`;
   await sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${doc.project_id},${actor.id},'document_uploaded',${JSON.stringify({description:`Uploaded ${doc.original_name}`})}::jsonb)`;
   return Response.json({success:true});
  }
  return Response.json({error:'Unsupported action.'},{status:400});
 }catch(e){return errorResponse(e);}
}
export async function DELETE(req:Request){
 try{const actor=await authorize(),sql=database(),{id}=await req.json();const doc=await getDocument(uuidCheck(id));
   await removeFile(String(doc.storage_key));
   await sql`UPDATE project_documents SET deleted_at=now(),deleted_by_id=${actor.id} WHERE id=${id}`;
   await sql`INSERT INTO activity_logs(project_id,actor_id,action,details) VALUES (${doc.project_id},${actor.id},'document_removed',${JSON.stringify({description:`Removed ${doc.original_name}`})}::jsonb)`;
   return Response.json({success:true});
 }catch(e){return errorResponse(e);}
}
