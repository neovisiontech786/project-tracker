// Legacy two-seat approval was retired. New accounts must use /api/team invitations.
// Never permit this old route to bypass dynamic RBAC.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const gone=()=>Response.json({error:'Founder approval has moved to Workspace Settings → Team.'},{status:410,headers:{'Cache-Control':'no-store'}});
export const GET=gone;
export const POST=gone;
