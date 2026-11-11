import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DeleteObjectCommand,GetObjectCommand,HeadObjectCommand,PutObjectCommand } from '@aws-sdk/client-s3';

export const BUCKET='project-documents';
function storage(){
 const endpoint=process.env.NEON_STORAGE_ENDPOINT;
 const accessKeyId=process.env.NEON_STORAGE_ACCESS_KEY;
 const secretAccessKey=process.env.NEON_STORAGE_SECRET_KEY;
 if(!endpoint||!accessKeyId||!secretAccessKey)throw new Error('Private document storage is not configured.');
 return new S3Client({endpoint,region:process.env.NEON_STORAGE_REGION||'us-east-2',forcePathStyle:true,credentials:{accessKeyId,secretAccessKey}});
}
export async function signUpload(key:string,mimeType:string){
 const client=storage();
 const url=await getSignedUrl(client,new PutObjectCommand({Bucket:BUCKET,Key:key,ContentType:mimeType}),{expiresIn:300});
 return {url,headers:{'Content-Type':mimeType}};
}
export async function signDownload(key:string,fileName:string){
 const client=storage();
 // The object is private; this is an ephemeral authorized link.
 return getSignedUrl(client,new GetObjectCommand({Bucket:BUCKET,Key:key,ResponseContentDisposition:`attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`}),{expiresIn:120});
}
export async function confirmFile(key:string,expectedSize:number){
 const actual=await storage().send(new HeadObjectCommand({Bucket:BUCKET,Key:key}));
 return Number(actual.ContentLength)===expectedSize;
}
export async function removeFile(key:string){await storage().send(new DeleteObjectCommand({Bucket:BUCKET,Key:key}));}
