"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DatabaseZap, LockKeyhole, RefreshCcw, Shield, UsersRound, UserPlus, Monitor, Moon, Sun } from "lucide-react";
import { useHub } from "@/lib/project-store";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import type { TeamRole } from "@/lib/types";

type Member = {id:string;name:string;email:string;role:TeamRole;active:boolean;revoked_at:string|null;removed_at:string|null};
type Invitation = {id:string;name:string;email:string;role:TeamRole;status:string};
const roles:TeamRole[]=['admin','founder','member'];

export default function SettingsPage(){
 const {reload,viewerRole,viewerId}=useHub();
 const {preference,resolvedTheme,setPreference}=useTheme();
 const [members,setMembers]=useState<Member[]>([]);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState<TeamRole>('member');
 const [error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(viewerRole!=='admin')return;
  try{
   const response=await fetch('/api/team',{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Team directory unavailable.');
   setMembers(data.members||[]);setInvitations(data.invitations||[]);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Unable to load team.');}
 },[viewerRole]);
 useEffect(()=>{void load();},[load]);
 async function mutate(payload:Record<string,unknown>){
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Team update failed.');
   setSuccess(payload.action==='invite'?'Invitation email sent.':'Team access updated successfully.');
   await load();await reload();
  }catch(e){setError(e instanceof Error?e.message:'Team update failed.');}
  finally{setBusy(false);}
 }
 async function invite(event:FormEvent){
  event.preventDefault();
  if(!name.trim()||!email.trim())return;
  await mutate({action:'invite',name:name.trim(),email:email.trim(),role});
  // Retain the form on an error so it can be retried without retyping.
 }
 function changeUser(action:string,member:Member,next?:TeamRole){
   if(action==='remove'&&!confirm(`Remove ${member.name}? Their access will be revoked; historical records will remain.`))return;
   if(action==='suspend'&&!confirm(`Suspend ${member.name}'s workspace access?`))return;
   void mutate({action,userId:member.id,...(next?{role:next}:{})});
 }
 return <div className="page-container settings-page">
  <div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> WORKSPACE SETTINGS</div>
   <h1>Settings</h1><p>Manage your preferences and team access.</p></div>
  <section className="surface-card appearance-settings">
   <div className="settings-heading"><span className="settings-icon"><Sun size={20}/></span><div><h2>Appearance</h2><p>Choose your preferred display theme.</p></div></div>
   <fieldset className="theme-options"><legend className="sr-only">Theme</legend>
    {([{value:'light',label:'Light',Icon:Sun},{value:'dark',label:'Dark',Icon:Moon},{value:'system',label:'System',Icon:Monitor}] as const)
      .map(({value,label,Icon})=><label className={`theme-option ${preference===value?'is-selected':''}`} key={value}>
       <input type="radio" name="workspace-theme" checked={preference===value} onChange={()=>setPreference(value as ThemePreference)}/>
       <Icon size={20}/><strong>{label}</strong><span>{value==='system'?'Follow device':`Use ${label.toLowerCase()} theme`}</span>
      </label>)}
   </fieldset><p className="theme-current">Current: <strong>{resolvedTheme} mode</strong></p>
  </section>
  <div className="settings-grid" style={{marginTop:20}}>
   <section className="surface-card settings-card"><div className="settings-heading">
    <span className="settings-icon"><UsersRound size={20}/></span><div><h2>Team management</h2><p>Dynamic workspace roles and invitations.</p></div></div>
    <div className="settings-note"><Shield size={16}/> Admins manage access, founders manage projects and finances, and members work on assigned projects.</div>
   </section>
   <section className="surface-card settings-card"><div className="settings-heading">
    <span className="settings-icon blue"><DatabaseZap size={20}/></span><div><h2>Workspace connections</h2><p>Neon PostgreSQL, private object storage and Clerk authentication.</p></div></div>
    <button type="button" className="btn btn-secondary" onClick={()=>void reload()}><RefreshCcw size={16}/> Refresh workspace</button>
    <div className="settings-note"><LockKeyhole size={16}/> Private projects remain visible only to their creator.</div>
   </section>
  </div>
  {viewerRole==='admin'&&<section className="surface-card settings-card" style={{marginTop:20}}>
    <div className="settings-heading"><span className="settings-icon"><UserPlus size={20}/></span><div>
     <h2>Invite a team member</h2><p>Clerk sends a verified invitation email. Invitations never grant access before acceptance.</p></div></div>
    <form className="modal-form" onSubmit={invite} style={{maxWidth:740}}>
     <div className="field-pair">
      <div className="field"><label htmlFor="invite-name">Full name</label><input id="invite-name" required value={name} onChange={e=>setName(e.target.value)} placeholder="New team member"/></div>
      <div className="field"><label htmlFor="invite-email">Email address</label><input id="invite-email" required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></div>
     </div>
     <div className="field"><label htmlFor="invite-role">Role</label><select id="invite-role" value={role} onChange={e=>setRole(e.target.value as TeamRole)}>{roles.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}</select></div>
     <button type="submit" className="btn btn-primary" disabled={busy}><UserPlus size={16}/> {busy?'Sending…':'Send invitation'}</button>
    </form>
   </section>}
  {viewerRole==='admin'&&<section className="surface-card settings-card" style={{marginTop:20}}>
    <div className="settings-heading"><span className="settings-icon"><UsersRound size={20}/></span>
     <div><h2>Team members</h2><p>Change roles or suspend, restore and remove accounts.</p></div>
     <button className="btn btn-secondary" disabled={busy} onClick={()=>void load()}><RefreshCcw size={15}/> Refresh</button></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {success&&<p className="inline-notice" role="status">{success}</p>}
    {members.filter(m=>!m.removed_at).map(member=><div className="member-row" key={member.id} style={{gap:12,flexWrap:'wrap'}}>
      <span className="owner-avatar settings-avatar">{member.name.charAt(0).toUpperCase()}</span>
      <div style={{flex:'1 1 220px',minWidth:0}}><strong>{member.name}</strong><span style={{overflowWrap:'anywhere'}}>{member.email} · {member.active&&!member.revoked_at?'Active':'Suspended'}</span></div>
      <select aria-label={`Role for ${member.name}`} value={member.role} disabled={busy||member.id===viewerId} onChange={e=>changeUser('changeRole',member,e.target.value as TeamRole)}>
       {roles.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
      </select>
      {member.id!==viewerId&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
       <button className="btn btn-secondary" disabled={busy} onClick={()=>changeUser(member.active?'suspend':'activate',member)}>{member.active?'Suspend':'Activate'}</button>
       <button className="btn btn-secondary" disabled={busy} onClick={()=>changeUser('remove',member)}>Remove</button>
      </div>}
     </div>)}
    {members.length===0&&<p className="nothing-yet">No team members found.</p>}
    <h3 style={{marginTop:20}}>Pending invitations</h3>
    {invitations.map(inv=><div className="member-row" key={inv.id} style={{gap:12}}>
     <div style={{flex:1,minWidth:0}}><strong>{inv.name}</strong><span style={{overflowWrap:'anywhere'}}>{inv.email} · {inv.role} · {inv.status}</span></div>
     <button className="btn btn-secondary" disabled={busy} onClick={()=>void mutate({action:'revokeInvite',id:inv.id})}>Revoke</button>
    </div>)}
    {!invitations.length&&<p className="nothing-yet">No pending invitations.</p>}
   </section>}
 </div>;
}