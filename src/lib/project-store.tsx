'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {Project,ProjectActivity,ProjectDocument,ProjectDraft,ProjectNote,ProjectStatus} from './types';
import {useAuth} from '@clerk/nextjs';

type HubData={projects:Project[];notes:ProjectNote[];documents:ProjectDocument[];activity:ProjectActivity[]};
type HubContext=HubData & {
 ready:boolean;error:string;
 reload:()=>Promise<void>;
 createProject:(draft:ProjectDraft)=>Promise<string>;
 updateProject:(id:string,values:Partial<Project>,reason?:string)=>Promise<void>;
 archiveProject:(id:string)=>Promise<void>;
 addNote:(projectId:string,content:string)=>Promise<void>;
 uploadDocument:(projectId:string,file:File,category:string)=>Promise<void>;
 openDocument:(doc:ProjectDocument)=>Promise<boolean>;
 deleteDocument:(doc:ProjectDocument)=>Promise<void>;
};
const Hub=createContext<HubContext|null>(null);
const EMPTY:HubData={projects:[],notes:[],documents:[],activity:[]};
async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...init});
 const body=await response.json().catch(()=>({error:'Invalid server response.'}));
 if(!response.ok)throw new Error(body.error||`Request failed (${response.status}).`);
 return body as T;
}
const json=(method:string,body:unknown):RequestInit=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export function ProjectStoreProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<HubData>(EMPTY);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');const {isLoaded,isSignedIn}=useAuth();
 const reload=useCallback(async()=>{try{const result=await api<HubData>('/api/hub');setData(result);setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to load workspace.');throw e;}finally{setReady(true);}},[]);
 useEffect(()=>{if(!isLoaded)return;if(!isSignedIn){setData(EMPTY);setError('');setReady(true);return;}void reload().catch(()=>{});const refresh=()=>{if(document.visibilityState==="visible")void reload().catch(()=>{});};window.addEventListener("focus",refresh);const id=window.setInterval(refresh,60000);return ()=>{window.removeEventListener("focus",refresh);window.clearInterval(id);};},[reload,isLoaded,isSignedIn]);
 const createProject=useCallback(async(draft:ProjectDraft)=>{
   const result=await api<{id:string}>('/api/hub',json('POST',{action:'create',draft}));await reload();return result.id;
 },[reload]);
 const updateProject=useCallback(async(id:string,values:Partial<Project>,reason?:string)=>{
   await api('/api/hub',json('PATCH',{id,values,reason}));await reload();
 },[reload]);
 const archiveProject=useCallback(async(id:string)=>{await updateProject(id,{archived:true});},[updateProject]);
 const addNote=useCallback(async(projectId:string,content:string)=>{
   await api('/api/hub',json('POST',{action:'note',projectId,body:content}));await reload();
 },[reload]);
 const uploadDocument=useCallback(async(projectId:string,file:File,category:string)=>{
   const start=await api<{id:string;url:string;headers?:Record<string,string>}>('/api/documents',json('POST',{action:'prepare',projectId,name:file.name,size:file.size,mimeType:file.type,category}));
   const upload=await fetch(start.url,{method:'PUT',headers:{...start.headers},body:file});
   if(!upload.ok)throw new Error('Upload to private document storage failed. Please try again.');
   await api('/api/documents',json('POST',{action:'complete',id:start.id}));await reload();
 },[reload]);
 const openDocument=useCallback(async(doc:ProjectDocument)=>{
   const {url}=await api<{url:string}>(`/api/documents?id=${encodeURIComponent(doc.id)}`);
   window.open(url,'_blank','noopener,noreferrer');return true;
 },[]);
 const deleteDocument=useCallback(async(doc:ProjectDocument)=>{
   await api('/api/documents',json('DELETE',{id:doc.id}));await reload();
 },[reload]);
 const value=useMemo(()=>({...data,ready,error,reload,createProject,updateProject,archiveProject,addNote,uploadDocument,openDocument,deleteDocument}),[data,ready,error,reload,createProject,updateProject,archiveProject,addNote,uploadDocument,openDocument,deleteDocument]);
 return <Hub.Provider value={value}>{children}</Hub.Provider>;
}
export function useHub(){const context=useContext(Hub);if(!context)throw new Error('useHub must be within ProjectStoreProvider');return context;}
export const PROJECT_STATUSES:ProjectStatus[]=['Not Started','In Progress','On Hold','Completed','Cancelled'];