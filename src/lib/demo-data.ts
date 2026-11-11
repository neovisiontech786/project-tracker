import type { Project, ProjectActivity, ProjectNote, ProjectDocument } from "./types";
const iso = (offsetDays: number) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString();
};

// Fictional preview data. No actual Neo Vision Tech project status is inferred here.
export const DEMO_PROJECTS: Project[] = [
  {id:"NVT-001",name:"Commerce Mobile App",description:"Mobile-first shopping experience with catalogue, checkout and order status.",type:"Client Project",client:"Northstar Retail",status:"In Progress",owner:"Both",progress:72,deadline:iso(12),startedAt:iso(-28),createdAt:iso(-28),updatedAt:iso(-1),accent:"indigo"},
  {id:"NVT-002",name:"Client Booking Platform",description:"Service discovery, booking enquiries and admin controls.",type:"Client Project",client:"Vertex Studio",status:"On Hold",owner:"Kabir",progress:38,deadline:iso(6),startedAt:iso(-18),createdAt:iso(-18),updatedAt:iso(-2),accent:"amber",onHoldReason:"Waiting for the client to share the final service pricing and approval of the booking flow."},
  {id:"NVT-003",name:"Supplier Management Portal",description:"A streamlined portal to manage inventory and supplier information.",type:"Internal Product",client:"",status:"In Progress",owner:"Naushad",progress:54,deadline:iso(20),startedAt:iso(-32),createdAt:iso(-32),updatedAt:iso(-3),accent:"cyan"},
  {id:"NVT-004",name:"Marketing Website",description:"Responsive marketing website with a modern content experience.",type:"Client Project",client:"Brightfield Co.",status:"Completed",owner:"Kabir",progress:100,deadline:iso(-5),startedAt:iso(-48),createdAt:iso(-48),updatedAt:iso(-5),accent:"emerald"},
  {id:"NVT-005",name:"Internal Design System",description:"Reusable UI patterns and foundations for future product builds.",type:"Internal Product",client:"",status:"Not Started",owner:"Both",progress:0,deadline:iso(33),startedAt:iso(2),createdAt:iso(-4),updatedAt:iso(-4),accent:"violet"},
  {id:"NVT-006",name:"Inventory Dashboard",description:"A central dashboard for operations, metrics and reporting.",type:"Client Project",client:"Kite Logistics",status:"In Progress",owner:"Naushad",progress:86,deadline:iso(4),startedAt:iso(-35),createdAt:iso(-35),updatedAt:iso(-1),accent:"rose"}
];
export const DEMO_NOTES: ProjectNote[] = [
  {id:"note-a",projectId:"NVT-002",author:"Kabir",content:"Paused until the client confirms pricing details and the revised booking flow.",createdAt:iso(-2)},
  {id:"note-b",projectId:"NVT-001",author:"Naushad",content:"The latest interface changes are complete. Continuing with the checkout integration.",createdAt:iso(-1)},
  {id:"note-c",projectId:"NVT-003",author:"Naushad",content:"Finished the initial supplier dashboard layout and data models.",createdAt:iso(-3)}
];
export const DEMO_DOCUMENTS: ProjectDocument[] = [
  {id:"doc-demo-1",projectId:"NVT-002",name:"Booking-Requirements.pdf",category:"Requirements",bytes:246900,uploadedBy:"Kabir",createdAt:iso(-10),demo:true},
  {id:"doc-demo-2",projectId:"NVT-002",name:"Project-Proposal.docx",category:"Quotation",bytes:87900,uploadedBy:"Kabir",createdAt:iso(-15),demo:true},
  {id:"doc-demo-3",projectId:"NVT-001",name:"App-Wireframes.pdf",category:"Design",bytes:1842500,uploadedBy:"Naushad",createdAt:iso(-7),demo:true},
  {id:"doc-demo-4",projectId:"NVT-003",name:"Supplier-Flows.pdf",category:"Requirements",bytes:682000,uploadedBy:"Naushad",createdAt:iso(-12),demo:true},
];
export const DEMO_ACTIVITY: ProjectActivity[] = [
  {id:"a-1",projectId:"NVT-001",author:"Naushad",action:"Updated progress to 72%",createdAt:iso(-1)},
  {id:"a-2",projectId:"NVT-006",author:"Naushad",action:"Added a project update",createdAt:iso(-1.5)},
  {id:"a-3",projectId:"NVT-002",author:"Kabir",action:"Put the project on hold",createdAt:iso(-2)},
  {id:"a-4",projectId:"NVT-003",author:"Naushad",action:"Updated progress to 54%",createdAt:iso(-3)},
  {id:"a-5",projectId:"NVT-004",author:"Kabir",action:"Marked project as completed",createdAt:iso(-5)}
];
