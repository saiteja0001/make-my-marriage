import { z } from "zod";

export const taskStatuses = { TODO: "To Do", IN_PROGRESS: "In Progress", COMPLETED: "Completed" } as const;
export const taskPriorities = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
export type TaskStatus = keyof typeof taskStatuses;
export type TaskPriority = keyof typeof taskPriorities;

export const taskTitleLimit = 200;
export const taskDescriptionLimit = 2000;
export const taskIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid item.").toLowerCase();
const status = z.enum(Object.keys(taskStatuses) as TaskStatus[]);
const priority = z.enum(Object.keys(taskPriorities) as TaskPriority[]);
const date = z.iso.datetime({ offset: true, error: "Provide a date and time with its timezone offset." })
  .refine((instant) => Number.isFinite(Date.parse(instant)), "Enter a valid due date.");

const fields = z.strictObject({
  title: z.string().trim().min(1, "Enter a task title.").max(taskTitleLimit),
  description: z.string().trim().max(taskDescriptionLimit).nullable().optional(),
  assignedMembershipId: taskIdSchema.nullable().optional(),
  eventId: taskIdSchema.nullable().optional(),
  dueDate: date.nullable().optional(),
  priority,
  status,
});

export const createTaskSchema = fields.extend({ priority: priority.default("MEDIUM"), status: status.default("TODO") });
export const updateTaskSchema = fields.partial().refine((input) => Object.keys(input).length > 0, "Provide at least one field to update.");
export const taskListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100000)).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  status: status.optional(),
  priority: priority.optional(),
  eventId: z.union([taskIdSchema, z.literal("none")]).optional(),
  assignedMembershipId: z.union([taskIdSchema, z.literal("none")]).optional(),
  mine: z.enum(["true", "false"]).transform((value) => value === "true").optional().default(false),
});

export type TaskValues = z.output<typeof createTaskSchema>;
export type TaskChanges = z.output<typeof updateTaskSchema>;
export type TaskFilters = z.output<typeof taskListSchema>;
