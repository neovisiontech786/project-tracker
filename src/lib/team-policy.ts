export type TeamRole='admin'|'founder'|'member';
export type Viewer={id:string;role:TeamRole};
export type ProjectAccess={createdById:string;ownerId:string;isPrivate:boolean};
export function canManageTeam(role:TeamRole){return role==='admin';}
export function canManageProjects(role:TeamRole){return role==='admin'||role==='founder';}
export function canAccessFinance(role:TeamRole){return role==='admin'||role==='founder';}
export function canReadProject(viewer:Viewer,project:ProjectAccess){
  if(project.createdById===viewer.id)return true;
  if(project.isPrivate)return false;
  return canManageProjects(viewer.role)||project.ownerId===viewer.id;
}
export function isTeamRole(value:unknown):value is TeamRole {
 return value==='admin'||value==='founder'||value==='member';
}
