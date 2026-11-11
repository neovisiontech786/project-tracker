"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, CirclePause, Clock3, FolderKanban, Layers3, TrendingUp } from "lucide-react";
import { CreateProjectButton } from "@/components/app-shell";
import { OwnerAvatars, ProgressBar, StatusBadge } from "@/components/ui";
import { useHub } from "@/lib/project-store";
import { dateCompact, isOverdue } from "@/lib/format";
import type { ProjectOwner, ProjectStatus } from "@/lib/types";

export default function DashboardPage(){
  const { projects }=useHub();
  const [founder,setFounder]=useState<"All"|ProjectOwner>("All");
  const visible=projects.filter(p=>!p.archived&&(founder==="All"||p.owner===founder||p.owner==="Both"));
  const count=(s:ProjectStatus)=>visible.filter(p=>p.status===s).length;
  const total=visible.length, active=count("In Progress"), paused=count("On Hold"), completed=count("Completed"), notStarted=count("Not Started");
  const remaining=total-completed-count("Cancelled");
  const onHold=visible.filter(p=>p.status==="On Hold");
  const recent=[...visible].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).slice(0,6);
  const upcoming=visible.filter(p=>p.deadline&&p.status!=="Completed"&&p.status!=="Cancelled").sort((a,b)=>new Date(a.deadline).getTime()-new Date(b.deadline).getTime()).slice(0,4);
  const metrics=[
    {label:"TOTAL PROJECTS",value:total,Icon:FolderKanban,type:"total",caption:"Across workspace",progress:100},
    {label:"IN PROGRESS",value:active,Icon:Activity,type:"running",caption:"Active projects",progress:total?100*active/total:0,status:"In Progress"},
    {label:"ON HOLD",value:paused,Icon:CirclePause,type:"hold",caption:"Needs attention",progress:total?100*paused/total:0,status:"On Hold"},
    {label:"COMPLETED",value:completed,Icon:CheckCircle2,type:"done",caption:"Successfully delivered",progress:total?100*completed/total:0,status:"Completed"},
    {label:"NOT STARTED",value:notStarted,Icon:Clock3,type:"new",caption:"In the backlog",progress:total?100*notStarted/total:0,status:"Not Started"},
    {label:"REMAINING",value:remaining,Icon:TrendingUp,type:"remaining",caption:"Not yet completed",progress:total?100*remaining/total:0},
  ];
  return <div className="page-container dashboard-page stitch-dashboard">
    <div className="dashboard-heading-row"><div><div className="eyebrow"><span className="eyebrow-line"/>PROJECT WORKSPACE</div><h1>Project Overview</h1><p>Track and manage all your projects across development and delivery.</p></div><div className="dashboard-heading-actions"><div className="founder-switch" aria-label="Filter projects by founder">{(["All","Kabir","Naushad"] as const).map(f=><button key={f} className={founder===f?"selected":""} onClick={()=>setFounder(f)}>{f}</button>)}</div><CreateProjectButton/></div></div>
    <div className="metric-grid six-metrics">{metrics.map(m=><Link href={m.status?`/projects?status=${encodeURIComponent(m.status)}`:"/projects"} className="metric-card" key={m.label}><div className="metric-head"><span>{m.label}</span><div className={`metric-icon metric-${m.type}`}><m.Icon size={16}/></div></div><strong>{m.value}</strong><span className="metric-foot">{m.caption}</span><div className="metric-track"><i style={{width:`${m.progress}%`}} className={`metric-fill metric-fill-${m.type}`}/></div></Link>)}</div>
    <div className="dashboard-columns dashboard-screenshot-grid"><div className="dashboard-primary">
      <section className="surface-card project-overview-card"><div className="card-titlebar"><div><h2>Recent Projects <span className="small-count">{total} total</span></h2><p>Most recently updated workspaces</p></div><Link className="link-action" href="/projects">View all projects <ArrowRight size={14}/></Link></div><div className="recent-table-scroll"><table className="project-table"><thead><tr><th>PROJECT &amp; CLIENT</th><th>TYPE</th><th>FOUNDER</th><th>STATUS</th><th>PROGRESS</th></tr></thead><tbody>{recent.map(p=><tr key={p.id}><td><Link className="project-table-name" href={`/projects/${p.id}`}><span className={`tiny-project-icon accent-${p.accent}`}>{p.name[0]}</span><span><strong>{p.name}</strong><small>{p.client||"Neo Vision Tech"}</small></span></Link></td><td><span className={`project-type-tag ${p.type==="Internal Product"?"internal":""}`}>{p.type==="Client Project"?"Client":"Internal"}</span></td><td><OwnerAvatars owner={p.owner} compact/></td><td><StatusBadge status={p.status}/></td><td><div className="progress-table-cell"><ProgressBar value={p.progress}/><span>{p.progress}%</span></div></td></tr>)}</tbody></table></div>{!recent.length&&<p className="empty-side">No projects yet. Create your first project.</p>}<div className="table-footer"><span>Showing {recent.length} of {total} projects</span><span>Shared by both founders</span></div></section>
      <section className="surface-card workspace-summary"><div className="summary-icon"><Layers3 size={18}/></div><div><strong>Everything in one place.</strong><p>Your project status, notes, important documents, and next steps — without the extra complexity.</p></div><Link href="/projects">Open projects <ArrowRight size={14}/></Link></section>
    </div><aside className="dashboard-secondary">
      <section className="surface-card attention-card"><div className="card-titlebar"><div><h2><CirclePause size={17} color="#e07749"/> Projects On Hold</h2><p>Why work is currently paused</p></div><span className="hold-count">{onHold.length} On Hold</span></div><div className="attention-list">{onHold.length?onHold.map(p=><Link className="attention-item" href={`/projects/${p.id}`} key={p.id}><div className="attention-item-head"><strong>{p.name}</strong><small>{p.client||"Internal"}</small></div><p><strong>Reason:</strong> {p.onHoldReason||"No reason was added."}</p><span>View project <ArrowRight size={14}/></span></Link>):<div className="attention-clear"><CheckCircle2 size={24}/><strong>No projects on hold</strong><p>Everything is moving forward.</p></div>}</div></section>
      <section className="surface-card deadline-card"><div className="card-titlebar"><div><h2><CalendarDays size={16} color="#4f46e5"/> Upcoming Deadlines</h2><p>Projects approaching their due dates</p></div></div><div className="deadline-list">{upcoming.length?upcoming.map(p=><Link href={`/projects/${p.id}`} className="deadline-item" key={p.id}><div className="deadline-item-top"><span className={`deadline-dot ${isOverdue(p.status,p.deadline)?"late":""}`}/><strong>{p.name}</strong><span className="deadline-date">{dateCompact(p.deadline)}</span></div><div className="deadline-sub">{p.owner} · {p.progress}% complete</div><ProgressBar value={p.progress}/></Link>):<div className="empty-side">No upcoming deadlines.</div>}</div></section>
    </aside></div>
  </div>;
}
