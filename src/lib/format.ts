import type { ProjectStatus } from "./types";
export function dateShort(value?: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"});
}
export function dateCompact(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {month:"short",day:"numeric"});
}
export function timeAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dateCompact(value);
}
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes/1024)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
}
export function isOverdue(status: ProjectStatus, deadline: string) {
  if (!deadline || status === "Completed" || status === "Cancelled") return false;
  const d = new Date(deadline); d.setHours(23,59,59,999);
  return d.getTime() < Date.now();
}
