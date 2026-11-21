"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useHub, PROJECT_STATUSES } from "@/lib/project-store";
import type { ProjectDraft, ProjectOwner, ProjectStatus, ProjectType } from "@/lib/types";
import { Modal } from "./ui";

const blank:ProjectDraft={name:"",description:"",type:"Client Project",client:"",status:"Not Started",owner:"All",deadline:"",isPrivate:false};
export function NewProjectModal({open,onClose}:{open:boolean,onClose:()=>void}){
 const router=useRouter(); const {createProject,viewerId,viewerRole,teamMembers}=useHub();
 const [draft,setDraft]=useState<ProjectDraft>(blank); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 const createRequestId=useRef<string|null>(null);
 const update=<K extends keyof ProjectDraft>(key:K,value:ProjectDraft[K])=>{createRequestId.current=null;setDraft(s=>({...s,[key]:value}));};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!draft.name.trim()){setError("Project name is required.");return;}if(draft.status==="On Hold"){setError("Create the project first, then add an on-hold reason.");return;}if(draft.isPrivate&&draft.owner!==viewerId){setError("A private project must be assigned to its creator.");return;}setBusy(true);try{if(!createRequestId.current)createRequestId.current=crypto.randomUUID();const id=await createProject({...draft,name:draft.name.trim()},createRequestId.current);createRequestId.current=null;setDraft(blank);setError("");onClose();router.push(`/projects/${id}`);}catch(e){setError(e instanceof Error?e.message:"Could not create project.");}finally{setBusy(false);}};
 if(viewerRole==='member')return null;
 return <Modal open={open} title="Create new project" subtitle="Give your project a home. You can change these details later." onClose={onClose} wide>
  <form className="modal-form" onSubmit={submit}>
   <div className="field"><label htmlFor="new-name">Project name <em>*</em></label><input id="new-name" value={draft.name} onChange={e=>update("name",e.target.value)} placeholder="e.g. E-commerce mobile application" autoFocus/></div>
   <div className="field"><label htmlFor="new-desc">Description</label><textarea id="new-desc" rows={3} value={draft.description} onChange={e=>update("description",e.target.value)} placeholder="A short summary of what this project is about..."/></div>
   <div className="field-pair"><div className="field"><label>Project type</label><select value={draft.type} onChange={e=>update("type",e.target.value as ProjectType)}><option>Client Project</option><option>Internal Product</option></select></div><div className="field"><label>Assigned to</label><select value={draft.owner} onChange={e=>update("owner",e.target.value as ProjectOwner)}>{draft.isPrivate?<option value={viewerId}>Only me</option>:<><option value="All">All admins & founders</option>{teamMembers.map(m=><option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}</>}</select></div></div>
   <div className="field"><label htmlFor="new-project-visibility">Visibility</label><select id="new-project-visibility" value={draft.isPrivate?"private":"shared"} onChange={e=>{const isPrivate=e.target.value==="private";createRequestId.current=null;setDraft(d=>({...d,isPrivate,owner:isPrivate?viewerId:d.owner}));}}><option value="shared">Shared — both founders can view and edit</option><option value="private">Private — only I can access</option></select><small className="privacy-helper">Admins and founders can access shared projects. Assigned members can also collaborate.</small></div>
   {draft.type==="Client Project"&&<div className="field"><label>Client name</label><input value={draft.client} onChange={e=>update("client",e.target.value)} placeholder="Client or company name"/></div>}
   <div className="field-pair"><div className="field"><label>Initial status</label><select value={draft.status} onChange={e=>update("status",e.target.value as ProjectStatus)}>{PROJECT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div><div className="field"><label>Expected deadline</label><input type="date" value={draft.deadline} onChange={e=>update("deadline",e.target.value)}/></div></div>
   {error&&<p className="form-error">{error}</p>}
   <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy?"Creating...":"Create project"} <ArrowRight size={16}/></button></div>
  </form>
 </Modal>;
}
