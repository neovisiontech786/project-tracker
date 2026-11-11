"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_ACTIVITY, DEMO_DOCUMENTS, DEMO_NOTES, DEMO_PROJECTS } from "./demo-data";
import type { Project, ProjectActivity, ProjectDocument, ProjectDraft, ProjectNote, ProjectStatus } from "./types";

type HubData = { projects: Project[]; notes: ProjectNote[]; documents: ProjectDocument[]; activity: ProjectActivity[] };
type HubContext = HubData & {
  ready: boolean;
  createProject: (draft: ProjectDraft) => string;
  updateProject: (id: string, values: Partial<Project>, reason?: string) => void;
  archiveProject: (id: string) => void;
  addNote: (projectId: string, content: string) => void;
  uploadDocument: (projectId: string, file: File, category: string) => Promise<void>;
  openDocument: (doc: ProjectDocument) => Promise<boolean>;
  deleteDocument: (doc: ProjectDocument) => Promise<void>;
  resetDemo: () => void;
};
const KEY = "nvt-project-hub-demo-v1";
const initialData: HubData = {projects: DEMO_PROJECTS, notes: DEMO_NOTES, documents: DEMO_DOCUMENTS, activity: DEMO_ACTIVITY};
const Hub = createContext<HubContext | null>(null);
const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open("nvt-project-hub-files",1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function putFile(id: string,file: File) {
  const db = await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx = db.transaction("files","readwrite"); tx.objectStore("files").put(file,id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function getFile(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("files","readonly");
    const req = tx.objectStore("files").get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function removeFile(id: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx = db.transaction("files","readwrite"); tx.objectStore("files").delete(id);
    tx.oncomplete = () => {db.close();resolve();}; tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
const ACTOR = "Kabir"; // Prototype persona only. Clerk identity will replace this in the backend phase.

export function ProjectStoreProvider({children}:{children:ReactNode}) {
  const [data, setData] = useState<HubData>(initialData);
  const [ready,setReady] = useState(false);
  useEffect(()=>{
    try {const raw=localStorage.getItem(KEY); if(raw) {const parsed=JSON.parse(raw) as HubData; if(Array.isArray(parsed.projects)) setData(parsed);}}
    catch { /* Keep example data when local storage is unavailable */ }
    setReady(true);
  },[]);
  useEffect(()=>{if(ready) {try {localStorage.setItem(KEY,JSON.stringify(data));}catch{}}},[data,ready]);
  const log = (projectId:string,action:string):ProjectActivity => ({id:uid(),projectId,action,author:ACTOR,createdAt:new Date().toISOString()});
  const createProject=(draft:ProjectDraft)=>{
    const id = `NVT-${String(Date.now()).slice(-7)}`;
    const now = new Date().toISOString();
    const p:Project = {...draft,id,progress:draft.status==="Completed"?100:0,startedAt:now,createdAt:now,updatedAt:now,accent:"indigo",client:draft.type==="Internal Product"?"":draft.client};
    setData(s=>({...s,projects:[p,...s.projects],activity:[log(id,"Created the project"),...s.activity]}));
    return id;
  };
  const updateProject=(id:string,values:Partial<Project>,reason?:string)=>{
    const current=data.projects.find(p=>p.id===id); if(!current) return;
    if(values.status === "On Hold" && !reason?.trim() && !current.onHoldReason) throw new Error("Add a reason before putting a project on hold.");
    const details:string[]=[];
    if(values.status && current.status!==values.status) details.push(`Changed status to ${values.status}`);
    if(typeof values.progress==="number" && current.progress!==values.progress) details.push(`Updated progress to ${values.progress}%`);
    if(!details.length) details.push("Updated project details");
    const stamp = new Date().toISOString();
    setData(s=>({...s,
      projects:s.projects.map(p=>p.id===id?{...p,...values,progress:values.status==="Completed"?100:(values.progress??p.progress),onHoldReason:values.status==="On Hold"? (reason?.trim()||p.onHoldReason):values.status && values.status!=="On Hold"?undefined:(values.onHoldReason??p.onHoldReason),updatedAt:stamp}:p),
      notes:reason?.trim()?[{id:uid(),projectId:id,content:`On hold: ${reason.trim()}`,author:ACTOR,createdAt:stamp},...s.notes]:s.notes,
      activity:[log(id,details.join(" · ")),...s.activity]
    }));
  };
  const archiveProject=(id:string)=>setData(s=>({...s,projects:s.projects.map(p=>p.id===id?{...p,archived:true,updatedAt:new Date().toISOString()}:p),activity:[log(id,"Archived the project"),...s.activity]}));
  const addNote=(projectId:string,content:string)=>{
    const clean=content.trim(); if(!clean) return;
    setData(s=>({...s,notes:[{id:uid(),projectId,content:clean,author:ACTOR,createdAt:new Date().toISOString()},...s.notes],activity:[log(projectId,"Added a project note"),...s.activity]}));
  };
  const uploadDocument=async(projectId:string,file:File,category:string)=>{
    const allowed=["pdf","doc","docx","xls","xlsx","jpg","jpeg","png","zip"];
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!allowed.includes(ext)) throw new Error("This file type is not supported.");
    if(file.size>20*1024*1024) throw new Error("Maximum file size is 20 MB.");
    const id=uid(); await putFile(id,file);
    const doc:ProjectDocument={id,projectId,name:file.name,category,bytes:file.size,uploadedBy:ACTOR,createdAt:new Date().toISOString()};
    setData(s=>({...s,documents:[doc,...s.documents],activity:[log(projectId,`Uploaded ${file.name}`),...s.activity]}));
  };
  const openDocument=async(doc:ProjectDocument)=>{
    if(doc.demo) return false;
    const blob=await getFile(doc.id); if(!blob)return false;
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a"); anchor.href=url; anchor.download=doc.name; document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    return true;
  };
  const deleteDocument=async(doc:ProjectDocument)=>{
    if(!doc.demo) await removeFile(doc.id);
    setData(s=>({...s,documents:s.documents.filter(d=>d.id!==doc.id),activity:[log(doc.projectId,`Removed ${doc.name}`),...s.activity]}));
  };
  const resetDemo=()=>{setData({projects:DEMO_PROJECTS,notes:DEMO_NOTES,documents:DEMO_DOCUMENTS,activity:DEMO_ACTIVITY});};
  const value=useMemo(()=>({...data,ready,createProject,updateProject,archiveProject,addNote,uploadDocument,openDocument,deleteDocument,resetDemo}),[data,ready]);
  return <Hub.Provider value={value}>{children}</Hub.Provider>;
}
export function useHub(){const hub=useContext(Hub);if(!hub)throw new Error("useHub requires ProjectStoreProvider");return hub;}
export const PROJECT_STATUSES: ProjectStatus[]=["Not Started","In Progress","On Hold","Completed","Cancelled"];
