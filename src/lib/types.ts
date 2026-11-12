export type ProjectStatus = "Not Started" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
export type ProjectOwner = "Kabir" | "Naushad" | "Both";
export type ProjectType = "Client Project" | "Internal Product";
export type ProjectAccent = "indigo" | "cyan" | "rose" | "amber" | "emerald" | "violet";

export interface Project {
  id: string;
  code?: string;
  name: string;
  description: string;
  type: ProjectType;
  client: string;
  status: ProjectStatus;
  owner: ProjectOwner;
  progress: number;
  deadline: string;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  accent: ProjectAccent;
  onHoldReason?: string;
  archived?: boolean;
  isPrivate: boolean;
  isCreator?: boolean;
}
export interface ProjectNote {
  id: string;
  projectId: string;
  author: string;
  content: string;
  createdAt: string;
}
export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  category: string;
  bytes: number;
  uploadedBy: string;
  createdAt: string;
  demo?: boolean;
}
export interface ProjectActivity {
  id: string;
  projectId: string;
  author: string;
  action: string;
  createdAt: string;
}
export interface ProjectDraft {
  name: string;
  description: string;
  type: ProjectType;
  client: string;
  status: ProjectStatus;
  owner: ProjectOwner;
  deadline: string;
  isPrivate: boolean;
}
