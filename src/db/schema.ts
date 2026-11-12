import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

// Auth is handled by Clerk. This is the app's two-user profile/allowlist table.
// The primary key is Clerk's user ID (e.g. user_...).
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projectTypeEnum = pgEnum("project_type", ["client", "internal"]);
export const projectStatusEnum = pgEnum("project_status", [
  "not_started",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);
export const documentCategoryEnum = pgEnum("document_category", [
  "requirements",
  "quotations",
  "agreements",
  "designs",
  "other",
]);

// Display code is derived from projectNumber: NVT-0001, NVT-0002, ...
// A database sequence allocates unique numbers without race conditions.
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectNumber: serial("project_number").notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    type: projectTypeEnum("type").notNull().default("client"),
    clientName: varchar("client_name", { length: 180 }),
    status: projectStatusEnum("status").notNull().default("not_started"),
    ownerSelection: varchar("owner_selection", { length: 16 }).notNull().default("Both"),
    progress: integer("progress").notNull().default(0),
    isPrivate: boolean("is_private").notNull().default(false),
    startDate: date("start_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdById: varchar("created_by_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedById: varchar("updated_by_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("projects_progress_range", sql`${t.progress} BETWEEN 0 AND 100`),
    check(
      "projects_completed_progress",
      sql`${t.status} <> 'completed' OR ${t.progress} = 100`,
    ),
    index("projects_status_idx").on(t.status),
    index("projects_due_date_idx").on(t.dueDate),
    index("projects_updated_at_idx").on(t.updatedAt),
    index("projects_archived_at_idx").on(t.archivedAt),
  ],
);

// One membership row per assigned founder; "Both" means two rows.
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_members_user_idx").on(t.userId),
  ],
);

export const projectNotes = pgTable(
  "project_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorId: varchar("author_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("project_notes_nonempty", sql`length(btrim(${t.body})) > 0`),
    index("project_notes_project_created_idx").on(t.projectId, t.createdAt),
  ],
);

// Every stop/resume cycle gets a record. At most one active hold per project.
export const projectHolds = pgTable(
  "project_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    previousStatus: projectStatusEnum("previous_status").notNull(),
    startedById: varchar("started_by_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resumedById: varchar("resumed_by_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    check("project_holds_nonempty_reason", sql`length(btrim(${t.reason})) > 0`),
    check("project_holds_previous_status", sql`${t.previousStatus} <> 'on_hold'`),
    check(
      "project_holds_resumed_after_started",
      sql`${t.resumedAt} IS NULL OR ${t.resumedAt} >= ${t.startedAt}`,
    ),
    uniqueIndex("project_holds_one_active_per_project")
      .on(t.projectId)
      .where(sql`${t.resumedAt} IS NULL`),
    index("project_holds_project_started_idx").on(t.projectId, t.startedAt),
  ],
);

// Store only metadata here. Actual file bytes live in PRIVATE object storage.
// storageKey is internal; generate short-lived signed URLs on the server only.
export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: documentCategoryEnum("category").notNull().default("other"),
    originalName: text("original_name").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadStatus: varchar("upload_status", { length: 16 }).notNull().default("pending"),
    uploadedById: varchar("uploaded_by_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: varchar("deleted_by_id", { length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    check("project_documents_size_positive", sql`${t.sizeBytes} > 0`),
    uniqueIndex("project_documents_storage_key_unique").on(t.storageKey),
    index("project_documents_project_uploaded_idx").on(t.projectId, t.uploadedAt),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 80 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_logs_project_created_idx").on(t.projectId, t.createdAt),
  ],
);

// Relational query helpers (all access control still belongs in server code).
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(projectMembers),
  createdProjects: many(projects, { relationName: "createdProjects" }),
  updatedProjects: many(projects, { relationName: "updatedProjects" }),
  notes: many(projectNotes),
  documents: many(projectDocuments, { relationName: "uploadedDocuments" }),
  createdHolds: many(projectHolds, { relationName: "createdHolds" }),
  resolvedHolds: many(projectHolds, { relationName: "resolvedHolds" }),
  activity: many(activityLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdById],
    references: [users.id],
    relationName: "createdProjects",
  }),
  updater: one(users, {
    fields: [projects.updatedById],
    references: [users.id],
    relationName: "updatedProjects",
  }),
  members: many(projectMembers),
  notes: many(projectNotes),
  holds: many(projectHolds),
  documents: many(projectDocuments),
  activity: many(activityLogs),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const projectNotesRelations = relations(projectNotes, ({ one }) => ({
  project: one(projects, {
    fields: [projectNotes.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [projectNotes.authorId],
    references: [users.id],
  }),
}));

export const projectHoldsRelations = relations(projectHolds, ({ one }) => ({
  project: one(projects, {
    fields: [projectHolds.projectId],
    references: [projects.id],
  }),
  startedBy: one(users, {
    fields: [projectHolds.startedById],
    references: [users.id],
    relationName: "createdHolds",
  }),
  resumedBy: one(users, {
    fields: [projectHolds.resumedById],
    references: [users.id],
    relationName: "resolvedHolds",
  }),
}));

export const projectDocumentsRelations = relations(projectDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocuments.projectId],
    references: [projects.id],
  }),
  uploader: one(users, {
    fields: [projectDocuments.uploadedById],
    references: [users.id],
    relationName: "uploadedDocuments",
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  project: one(projects, {
    fields: [activityLogs.projectId],
    references: [projects.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}));
