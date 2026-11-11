"use client";
import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronDown, ChevronRight, FolderKanban, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { CreateProjectButton } from "@/components/app-shell";
import { EmptyState, OwnerAvatars, ProgressBar, StatusBadge } from "@/components/ui";
import { useHub } from "@/lib/project-store";
import { dateCompact } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";
const filters=["All Projects","In Progress","On Hold","Not Started","Completed","Cancelled"] as const;
export default function ProjectsPage(){return <Suspense fallback={<div className="page-container"><div className="surface-card" style={{padding:24}}>Loading projects…</div></div>}><ProjectsContent/></Suspense>}
function ProjectsContent(){
 const {projects}=useHub();const params=useSearchParams();const fromUrl=params.get("status")||"All Projects";const archived=params.get("view")==="archived";const owner=params.get("owner");
 const [filter,setFilter]=useState<string>(fromUrl);const [search,setSearch]=useState("");const [layout,setLayout]=useState<"list"|"cards">("list");
 useEffect(()=>{setFilter(fromUrl);},[fromUrl]);
 const visible=projects.filter(p=>Boolean(p.archived)===archived && (!owner||p.owner===owner||p.owner==="Both"));
 const results=useMemo(()=>visible.filter(p=>(filter==="All Projects"||p.status===filter)&&`${p.name} ${p.client} ${p.description}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()),[visible,filter,search]);
 return <div className="page-container project-list-page"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>PROJECT WORKSPACE</div><h1>{archived?"Archived projects":owner?`${owner}’s projects`:"All projects"}</h1><p>{archived?"A record of projects you have archived.":"Everything you’re building, beautifully organized."}</p></div><CreateProjectButton/></div>
  <div className="project-intro"><div className="project-intro-icon"><FolderKanban size={22}/></div><div><strong>{visible.length} projects in your workspace</strong><p>Stay aligned on what's active, paused, or completed.</p></div><div className="project-intro-ornament">✳</div></div>
  <div className="list-toolbar"><div className="filter-tabs">{filters.map(f=><button key={f} onClick={()=>setFilter(f)} className={filter===f?"filter-tab active":"filter-tab"}>{f}{f==="All Projects"&&<span>{visible.length}</span>}</button>)}</div></div>
  <div className="search-row"><div className="list-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by project or client..." aria-label="Search projects"/></div><div className="results-label"><SlidersHorizontal size={16}/>{results.length} results</div><div className="view-toggle"><button onClick={()=>setLayout("list")} className={layout==="list"?"selected":""} title="Table view" aria-label="Table view"><List size={17}/></button><button onClick={()=>setLayout("cards")} className={layout==="cards"?"selected":""} title="Grid view" aria-label="Grid view"><LayoutGrid size={17}/></button></div></div>
  {results.length?layout==="list"?<section className="surface-card projects-list-card"><div className="recent-table-scroll"><table className="project-table full-project-table"><thead><tr><th>PROJECT</th><th>STATUS</th><th>PROGRESS</th><th>ASSIGNED TO</th><th>DUE DATE</th><th/></tr></thead><tbody>{results.map(p=><tr key={p.id}><td><Link className="project-table-name" href={`/projects/${p.id}`}><span className={`tiny-project-icon accent-${p.accent}`}>{p.name[0]}</span><span><strong>{p.name}</strong><small>{p.client||p.type}</small></span></Link></td><td><StatusBadge status={p.status}/></td><td><div className="progress-table-cell"><ProgressBar value={p.progress}/><span>{p.progress}%</span></div></td><td><OwnerAvatars owner={p.owner}/></td><td><span className="date-text">{dateCompact(p.deadline)}</span></td><td><Link className="table-arrow" href={`/projects/${p.id}`}><ChevronRight size={18}/></Link></td></tr>)}</tbody></table></div></section>:
  <div className="project-card-grid">{results.map(p=><Link href={`/projects/${p.id}`} key={p.id} className="project-grid-card"><div className="project-grid-card-top"><span className={`large-project-icon accent-${p.accent}`}>{p.name[0]}</span><ArrowUpRight size={17}/></div><h3>{p.name}</h3><p>{p.description||p.client||p.type}</p><div className="project-card-status"><StatusBadge status={p.status}/></div><div className="project-card-progress"><span>Progress <b>{p.progress}%</b></span><ProgressBar value={p.progress}/></div><div className="project-grid-footer"><OwnerAvatars owner={p.owner} compact/><span>{dateCompact(p.deadline)}</span></div></Link>)}</div>:
  <div className="surface-card"><EmptyState icon={<FolderKanban size={26}/>} title="No projects found" description="Try a different filter or create a new project." action={<CreateProjectButton label="Create a project"/>}/></div>}
 </div>;
}
