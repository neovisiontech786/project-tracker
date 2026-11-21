"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { ProjectOwner, ProjectStatus } from "@/lib/types";
import { useHub } from "@/lib/project-store";

export function StatusBadge({status}:{status:ProjectStatus}){
  const cls:Record<ProjectStatus,string>={"In Progress":"status-running","On Hold":"status-hold","Completed":"status-done","Not Started":"status-new","Cancelled":"status-cancelled"};
  return <span className={`status-badge ${cls[status]}`}><span className="status-dot"/>{status}</span>;
}
export function OwnerAvatars({owner,compact=false}:{owner:ProjectOwner,compact?:boolean}){
 const {teamMembers}=useHub();
 const assigned=owner==='All'?teamMembers.filter(m=>m.role==='admin'||m.role==='founder'):teamMembers.filter(m=>m.id===owner);
 const label=owner==='All'?'All admins & founders':assigned[0]?.name||'Unassigned';
 return <span className="owner-stack">
  {assigned.slice(0,3).map(m=><span className="owner-avatar" key={m.id} title={m.name}>{m.name.charAt(0).toUpperCase()}</span>)}
  {assigned.length>3&&<span className="owner-avatar" title={label}>+{assigned.length-3}</span>}
  {!compact&&<span className="owner-label">{label}</span>}
 </span>;
}
export function ProgressBar({value}:{value:number}){
 return <div className="progress-outer"><span style={{width:`${Math.max(0,Math.min(value,100))}%`}} className="progress-inner"/></div>;
}
export function Modal({open,onClose,title,subtitle,children,wide=false}:{open:boolean,onClose:()=>void,title:string,subtitle?:string,children:ReactNode,wide?:boolean}){
 const dialogRef=useRef<HTMLElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
   if(!open)return;
   const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
   const priorOverflow=document.body.style.overflow;
   document.body.style.overflow='hidden';
   const dialog=dialogRef.current;
   const tabbable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')||[]).filter(el=>el.getClientRects().length>0);
   (tabbable()[0]||dialog)?.focus();
   const handleKey=(e:KeyboardEvent)=>{
     if(e.key==='Escape'){e.preventDefault();closeRef.current();return;}
     if(e.key!=='Tab')return;
     const controls=tabbable();
     if(!controls.length){e.preventDefault();dialog?.focus();return;}
     const first=controls[0],last=controls[controls.length-1];
     if(e.shiftKey && (document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus();}
     else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',handleKey);
   return ()=>{document.removeEventListener('keydown',handleKey);document.body.style.overflow=priorOverflow;previous?.focus();};
 },[open]);
 if(!open)return null;
 return <div className="modal-screen" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}} role="presentation"><section ref={dialogRef} tabIndex={-1} className={`modal-panel ${wide?"modal-wide":""}`} role="dialog" aria-modal="true" aria-label={title}>
   <header className="modal-top"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></header>
   {children}
 </section></div>;
}
export function EmptyState({icon,title,description,action}:{icon:ReactNode,title:string,description:string,action?:ReactNode}) {
 return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
