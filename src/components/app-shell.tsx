"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArrowUpRight, Bell, ChevronsUpDown, CircleHelp, FolderKanban, LayoutGrid, LockKeyhole, Menu, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { useHub } from "@/lib/project-store";
import {useUser,SignOutButton} from "@clerk/nextjs";
import { NewProjectModal } from "./new-project-modal";

const NAV=[{title:"Overview",entries:[{href:"/dashboard",name:"Dashboard",Icon:LayoutGrid},{href:"/projects",name:"All Projects",Icon:FolderKanban},{href:"/projects?view=archived",name:"Archived",Icon:Archive},{href:"/projects?view=private",name:"My Private Projects",Icon:LockKeyhole}]},{title:"Workspace",entries:[{href:"/settings",name:"Settings",Icon:Settings2}]}];
export function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname(); const router=useRouter(); const {projects,error,ready}=useHub();const {user}=useUser();
 const [mobileOpen,setMobileOpen]=useState(false); const [newOpen,setNewOpen]=useState(false);const [searchOpen,setSearchOpen]=useState(false);const [term,setTerm]=useState("");
 const activeCount=projects.filter(p=>!p.archived&&p.status==="In Progress").length;
 const searchable=projects.filter(p=>!p.archived&&(`${p.name} ${p.client}`).toLowerCase().includes(term.toLowerCase())).slice(0,5);
 const nav=<>
   <div className="brand-row"><div className="brand-mark"><span className="brand-mark-line"/></div><div className="brand-copy"><strong>Neo Vision</strong><span>PROJECT HUB</span></div><ChevronsUpDown size={15} className="brand-chevrons"/></div>
   <div className="workspace-pill"><span className="workspace-circle">N</span><div><strong>Neo Vision Tech</strong><small>Private workspace</small></div><span className="workspace-more">•••</span></div>
   <div className="sidebar-label section-label">WORKSPACE</div>
   <div className="sidebar-nav">{NAV[0].entries.map(({href,name,Icon})=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className={`nav-link ${path===href||(href==="/projects"&&path.startsWith("/projects"))?"is-active":""}`}><Icon size={18} strokeWidth={1.9}/><span>{name}</span>{name==="All Projects"&&<span className="nav-counter">{projects.filter(p=>!p.archived).length}</span>}</Link>)}</div>
   <div className="sidebar-label section-label">FOUNDERS</div><div className="sidebar-nav"><Link href="/projects?owner=Kabir" className="nav-link" onClick={()=>setMobileOpen(false)}><span className="founder-nav-dot kabir"/> Kabir's Projects</Link><Link href="/projects?owner=Naushad" className="nav-link" onClick={()=>setMobileOpen(false)}><span className="founder-nav-dot naushad"/> Naushad's Projects</Link><Link href="/projects?status=On%20Hold" className="nav-link" onClick={()=>setMobileOpen(false)}><span className="founder-nav-dot hold"/> On Hold</Link></div><div className="sidebar-label section-label">PREFERENCES</div>
   <div className="sidebar-nav">{NAV[1].entries.map(({href,name,Icon})=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className={`nav-link ${path===href?"is-active":""}`}><Icon size={18} strokeWidth={1.9}/><span>{name}</span></Link>)}</div>
   <div className="sidebar-bottom">
     <div className="sidebar-hint"><div className="hint-stars"><Sparkles size={17}/></div><strong>Less tracking. More doing.</strong><p>One calm place for every project your team is running.</p><span>{activeCount} projects in progress <ArrowUpRight size={13}/></span></div>
     <div className="sidebar-profile"><div className="profile-avatar">{(user?.firstName||user?.primaryEmailAddress?.emailAddress||"F")[0].toUpperCase()}</div><div><strong>{user?.fullName||"Founder"}</strong><small>Neo Vision Tech</small></div><SignOutButton redirectUrl="/sign-in"><button title="Sign out" className="icon-button"><ArrowUpRight size={15}/></button></SignOutButton></div>
   </div>
 </>;
 if(error && (error.includes("Founder access pending") || error.includes("different Clerk account") || error.includes("founder seat"))){
   return <div className="access-wait-page"><section className="access-wait-card">
     <div className="signin-logo"><span className="brand-mark-line"/></div>
     <span className="signin-eyebrow">NEO VISION TECH · PROJECT HUB</span>
     <h1>Account approval required</h1>
     <p>{error}</p>
     <p>Only Kabir and Naushad have access to project data. If this is Naushad's account, Kabir can approve it in Workspace Settings.</p>
     <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
       <button className="btn btn-primary" onClick={()=>void reload().catch(()=>{})}>Check access again</button>
       <SignOutButton redirectUrl="/sign-in"><button className="btn btn-secondary">Sign out</button></SignOutButton>
     </div>
   </section></div>;
 }
 return <div className="app-root">
   <aside className="sidebar desktop-sidebar">{nav}</aside>
   {mobileOpen&&<div className="mobile-overlay" onClick={()=>setMobileOpen(false)}><aside className="sidebar mobile-sidebar" onClick={e=>e.stopPropagation()}><button className="mobile-close icon-button" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X size={20}/></button>{nav}</aside></div>}
   <div className="main-column">
     <header className="topbar"><div className="topbar-left"><button className="icon-button hamburger" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><span className="breadcrumb-root">Workspace</span><span className="breadcrumb-slash">/</span><span className="breadcrumb-current">{path.startsWith("/projects/")?"Project details":path.startsWith("/projects")?"Projects":path==="/settings"?"Settings":"Dashboard"}</span></div>
       <div className="topbar-right"><button className="top-search" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>Quick search</span><kbd>⌘ K</kbd></button><span className="topbar-split"/><button className="icon-button notification-button" title="Demo: notifications aren't connected yet" onClick={()=>setSearchOpen(true)} aria-label="Search project updates"><Bell size={19}/><span className="notification-dot"/></button><div className="top-avatar">{(user?.firstName||"F")[0]}</div></div>
     </header>
     {error&&<div className="demo-strip" role="alert"><Sparkles size={13}/><strong>Connection issue</strong><span>{error}</span></div>}{!ready&&<div className="demo-strip">Loading shared workspace…</div>}
     <main className="page-main">{children}</main>
   </div>
   <button className="mobile-fab" onClick={()=>setNewOpen(true)} aria-label="New project"><Plus size={22}/></button>
   <NewProjectModal open={newOpen} onClose={()=>setNewOpen(false)}/>
   <div className="sr-only"><button onClick={()=>setNewOpen(true)}>Create</button></div>
   {searchOpen&&<div className="search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false);}}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search projects"><div className="search-dialog-input"><Search size={20}/><input autoFocus value={term} placeholder="Search projects or clients..." onChange={e=>setTerm(e.target.value)}/><button className="kbd-button" onClick={()=>setSearchOpen(false)}>ESC</button></div><div className="search-results"><span className="search-results-label">PROJECTS</span>{searchable.length?searchable.map(p=><button key={p.id} className="search-hit" onClick={()=>{setSearchOpen(false);setTerm("");router.push(`/projects/${p.id}`);}}><span className={`tiny-project-icon accent-${p.accent}`}>{p.name[0]}</span><span>{p.name}<small>{p.client||p.type}</small></span><ArrowUpRight size={16}/></button>):<div className="search-none">No projects match that search.</div>}</div></section></div>}
 </div>;
}
export function CreateProjectButton({label="New Project",className="btn btn-primary"}:{label?:string,className?:string}){
 const [open,setOpen]=useState(false);
 return <><button className={className} onClick={()=>setOpen(true)}><Plus size={17}/>{label}</button><NewProjectModal open={open} onClose={()=>setOpen(false)}/></>;
}
