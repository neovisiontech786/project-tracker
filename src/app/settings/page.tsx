"use client";
import { useCallback, useEffect, useState } from "react";
import { DatabaseZap, LockKeyhole, RefreshCcw, Shield, UsersRound, UserCheck, AlertCircle } from "lucide-react";
import { useHub } from "@/lib/project-store";

type PendingUser={id:string;email:string;display_name:string;created_at:string};
type Founder={email:string;display_name:string};

export default function SettingsPage(){
 const {reload,viewerName}=useHub();
 const [pending,setPending]=useState<PendingUser[]>([]);
 const [members,setMembers]=useState<Founder[]>([]);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [busyId,setBusyId]=useState("");
 const load=useCallback(async()=>{
   if(viewerName!=="Kabir")return;
   try{
     const response=await fetch("/api/founders",{cache:"no-store"});
     if(!response.ok)throw new Error("Could not load founder access requests.");
     const data=await response.json();
     setPending(data.pending||[]);setMembers(data.members||[]);setError("");
   }catch(e){setError(e instanceof Error?e.message:"Could not load founder access requests.");}
 },[viewerName]);
 useEffect(()=>{void load();},[load]);
 const approve=async(user:PendingUser)=>{
   if(!confirm(`Approve ${user.email} as Naushad? Verify this is his actual Clerk account before approving.`))return;
   setBusyId(user.id);setSuccess("");setError("");
   try{
     const res=await fetch("/api/founders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve",userId:user.id})});
     const data=await res.json();
     if(!res.ok)throw new Error(data.error||"Approval failed.");
     setSuccess(`${user.email} is approved as Naushad. He can refresh the app now.`);
     await load();await reload();
   }catch(e){setError(e instanceof Error?e.message:"Approval failed.");}
   finally{setBusyId("");}
 };
 const naushadActive=members.some(m=>m.display_name==="Naushad");
 return <div className="page-container settings-page">
   <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>PREFERENCES</div>
     <h1>Workspace settings</h1><p>Manage your private, two-founder workspace.</p></div></div>
   <div className="settings-grid">
    <section className="surface-card settings-card">
      <div className="settings-heading"><span className="settings-icon"><UsersRound size={20}/></span><div><h2>Team members</h2><p>Two founders with equal project access.</p></div></div>
      <div className="member-row"><div className="owner-avatar avatar-k settings-avatar">K</div><div><strong>Kabir</strong><span>Founder · Full access</span></div><span className="member-tag">Founder 1</span></div>
      <div className="member-row"><div className="owner-avatar avatar-n settings-avatar">N</div><div><strong>Naushad</strong><span>Founder · Full access</span></div><span className="member-tag">{naushadActive?"Active":"Account 2"}</span></div>
      <div className="settings-note"><LockKeyhole size={16}/> Shared projects are accessible to both founders. Private projects are accessible only to their creator.</div>
    </section>
    <section className="surface-card settings-card">
      <div className="settings-heading"><span className="settings-icon blue"><DatabaseZap size={20}/></span><div><h2>Workspace connections</h2><p>Shared projects and files are stored in Neon.</p></div></div>
      <div className="settings-info"><div><span>Project data</span><strong>Neon PostgreSQL</strong></div><div><span>Uploaded files</span><strong>Private Neon Object Storage</strong></div><div><span>Sign-in</span><strong>Clerk</strong></div></div>
      <button className="btn btn-secondary settings-reset" onClick={()=>{void reload().catch(()=>{});}}><RefreshCcw size={16}/> Refresh workspace data</button>
      <div className="settings-note"><Shield size={16}/> Assignment does not hide shared projects.</div>
    </section>
   </div>
   {viewerName==="Kabir"&&<section className="surface-card settings-card" style={{marginTop:20}}>
    <div className="settings-heading"><span className="settings-icon"><UserCheck size={20}/></span><div>
     <h2>Founder access requests</h2><p>If Naushad signed in with a different Clerk email, approve his account here.</p></div>
     <button className="btn btn-secondary" onClick={()=>void load()} disabled={!!busyId}><RefreshCcw size={15}/> Refresh requests</button>
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {success&&<div className="inline-notice"><UserCheck size={16}/>{success}</div>}
    {naushadActive?<div className="settings-note"><Shield size={16}/> Naushad's founder seat is active. No more accounts can be approved.</div>:
      pending.length===0?<p className="nothing-yet">No pending access requests. Ask Naushad to sign in to this same Clerk application, then refresh this page.</p>:
      pending.map(u=><div key={u.id} className="member-row" style={{gap:16}}>
       <div className="owner-avatar settings-avatar"><AlertCircle size={16}/></div>
       <div style={{flex:1,minWidth:0}}><strong>{u.display_name}</strong><span style={{overflowWrap:"anywhere"}}>{u.email}</span></div>
       <button className="btn btn-primary" disabled={!!busyId} onClick={()=>void approve(u)}>{busyId===u.id?"Approving…":"Approve as Naushad"}</button>
      </div>)}
    <div className="settings-note"><LockKeyhole size={16}/> Only approve the account after confirming the email belongs to Naushad. Other requests have no project access.</div>
   </section>}
 </div>;
}
