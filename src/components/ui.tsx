"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectOwner, ProjectStatus } from "@/lib/types";

export function StatusBadge({status}:{status:ProjectStatus}){
  const cls:Record<ProjectStatus,string>={"In Progress":"status-running","On Hold":"status-hold","Completed":"status-done","Not Started":"status-new","Cancelled":"status-cancelled"};
  return <span className={`status-badge ${cls[status]}`}><span className="status-dot"/>{status}</span>;
}
export function OwnerAvatars({owner,compact=false}:{owner:ProjectOwner,compact?:boolean}){
  return <span className="owner-stack">
    {(owner==="Both"?["Kabir","Naushad"]:[owner]).map(o=><span className={`owner-avatar ${o==="Naushad"?"avatar-n":"avatar-k"}`} key={o} title={o}>{o==="Naushad"?"N":"K"}</span>)}
    {!compact&&<span className="owner-label">{owner=== "Both"?"Both founders":owner}</span>}
  </span>;
}
export function ProgressBar({value}:{value:number}){
 return <div className="progress-outer"><span style={{width:`${Math.max(0,Math.min(value,100))}%`}} className="progress-inner"/></div>;
}
export function Modal({open,onClose,title,subtitle,children,wide=false}:{open:boolean,onClose:()=>void,title:string,subtitle?:string,children:ReactNode,wide?:boolean}){
 if(!open)return null;
 return <div className="modal-screen" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}} role="presentation"><section className={`modal-panel ${wide?"modal-wide":""}`} role="dialog" aria-modal="true" aria-label={title}>
   <header className="modal-top"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></header>
   {children}
 </section></div>;
}
export function EmptyState({icon,title,description,action}:{icon:ReactNode,title:string,description:string,action?:ReactNode}) {
 return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
