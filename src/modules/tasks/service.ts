import "server-only";
import { createHash } from "node:crypto";
import { Types, type ClientSession, type QueryFilter } from "mongoose";
import { User } from "@/modules/auth/models";
import { WeddingEvent } from "@/modules/events/model";
import { lockActiveEventReferences } from "@/modules/events/service";
import { WeddingMembership } from "@/modules/wedding/models";
import { connectDatabase } from "@/server/db/mongoose";
import { prepareTaskStorage, TaskCreationRequest, WeddingTask, type TaskRecord } from "./model";
import type { TaskChanges, TaskFilters, TaskValues } from "./validation";

export class TaskConflict extends Error {
  constructor() {
    super("This task changed. Open the latest version before trying again.");
  }
}
export class TaskCreationGone extends Error {
  constructor() {
    super("This task was created and has since been deleted.");
  }
}
export class TaskReferenceUnavailable extends Error {
  constructor(public field: "assignedMembershipId" | "eventId", message: string) {
    super(message);
  }
}

export function taskDraftContext(membershipId: string, weddingId: string, timeZone: string) {
  return createHash("sha256").update(JSON.stringify([membershipId, weddingId, timeZone])).digest("hex");
}

async function lookupMembers(weddingId: string, ids?: string[]) {
  const members = await WeddingMembership.find({ weddingId, ...(ids && { _id: { $in: ids } }) })
    .select("userId role").lean();
  if (!members.length) return [];
  const users = await User.find({ _id: { $in: members.map(({ userId }) => userId) } }).select("name").lean();
  const names = new Map(users.map(({ _id, name }) => [_id.toString(), name]));
  return members.flatMap(({ _id, userId, role }) => {
    const name = names.get(userId.toString());
    return name ? [{ id: _id.toString(), name, role }] : [];
  });
}

async function lookupEvents(weddingId: string, options: { ids?: string[]; activeOnly?: boolean } = {}) {
  const events = await WeddingEvent.find({
    weddingId,
    ...(options.ids && { _id: { $in: options.ids } }),
    ...(options.activeOnly && { archivedAt: null }),
  }).select("name archivedAt").sort({ startsAt: 1, _id: 1 }).lean();
  return events.map(({ _id, name, archivedAt }) => ({
    id: _id.toString(), name, archivedAt: archivedAt?.toISOString() ?? null,
  }));
}

export async function taskOptions(weddingId: string, activeEventsOnly = true) {
  await connectDatabase();
  const [members, events] = await Promise.all([
    lookupMembers(weddingId),
    lookupEvents(weddingId, { activeOnly: activeEventsOnly }),
  ]);
  return { members: members.sort((a, b) => a.name.localeCompare(b.name)), events };
}

async function taskDetails(weddingId: string, tasks: TaskRecord[]) {
  if (!tasks.length) return [];
  const memberIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const task of tasks) {
    if (task.assignedMembershipId) memberIds.add(task.assignedMembershipId.toString());
    if (task.eventId) eventIds.add(task.eventId.toString());
  }
  const [members, events] = await Promise.all([
    memberIds.size ? lookupMembers(weddingId, [...memberIds]) : [],
    eventIds.size ? lookupEvents(weddingId, { ids: [...eventIds] }) : [],
  ]);
  const assignees = new Map(members.map((member) => [member.id, member]));
  const eventNames = new Map(events.map((event) => [event.id, event]));

  return tasks.map((task) => {
    const assignedMembershipId = task.assignedMembershipId?.toString() ?? null;
    const eventId = task.eventId?.toString() ?? null;
    return {
      id: task._id.toString(), title: task.title, description: task.description ?? null,
      assignedMembershipId, eventId,
      assignee: assignedMembershipId ? assignees.get(assignedMembershipId) ?? null : null,
      event: eventId ? eventNames.get(eventId) ?? null : null,
      dueDate: task.dueDate?.toISOString() ?? null,
      priority: task.priority, status: task.status,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt?.toISOString() ?? null, updatedAt: task.updatedAt?.toISOString() ?? null,
      revision: task.__v ?? 0,
    };
  });
}

export type TaskDetails = Awaited<ReturnType<typeof taskDetails>>[number];

export async function listTasks(weddingId: string, membershipId: string, filters: TaskFilters) {
  await connectDatabase();
  const { page, limit, q, status, priority, eventId, assignedMembershipId, mine } = filters;
  const pagination = { page, limit, total: 0, totalPages: 0 };
  if (mine && assignedMembershipId && assignedMembershipId !== membershipId) {
    return { data: [], pagination };
  }

  const filter: QueryFilter<TaskRecord> = { weddingId };
  if (q) filter.title = { $regex: q.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&"), $options: "i" };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (eventId) filter.eventId = eventId === "none" ? null : eventId;
  if (mine) filter.assignedMembershipId = membershipId;
  else if (assignedMembershipId) filter.assignedMembershipId = assignedMembershipId === "none" ? null : assignedMembershipId;

  const [tasks, total] = await Promise.all([
    WeddingTask.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    WeddingTask.countDocuments(filter),
  ]);
  return {
    data: await taskDetails(weddingId, tasks),
    pagination: { ...pagination, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTaskCounts(weddingId: string) {
  await connectDatabase();
  const [counts] = await WeddingTask.aggregate<{ total: number; completed: number }>([
    { $match: { weddingId: new Types.ObjectId(weddingId) } },
    { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } } } },
  ]);
  return { total: counts?.total ?? 0, completed: counts?.completed ?? 0 };
}

export async function getTaskOverview(weddingId: string, dayStart: Date) {
  await connectDatabase();
  const [counts, upcoming] = await Promise.all([
    getTaskCounts(weddingId),
    WeddingTask.find({ weddingId, status: { $ne: "COMPLETED" }, dueDate: { $gte: dayStart } })
      .select("title dueDate status").sort({ dueDate: 1, _id: 1 }).limit(3).lean(),
  ]);
  return {
    ...counts,
    upcoming: upcoming.flatMap(({ _id, title, dueDate, status }) => dueDate
      ? [{ id: _id.toString(), title, dueDate: dueDate.toISOString(), status }]
      : []),
  };
}

export async function getTask(weddingId: string, taskId: string) {
  await connectDatabase();
  const task = await WeddingTask.findOne({ _id: taskId, weddingId }).lean();
  return task ? (await taskDetails(weddingId, [task]))[0] : null;
}

async function lockNewReferences(weddingId: string, input: TaskChanges, session: ClientSession, existing?: TaskRecord) {
  const { assignedMembershipId, eventId } = input;
  // Write to the referenced documents so a concurrent removal or archive cannot commit against the same snapshot.
  const revision = { $inc: { taskReferenceRevision: 1 } };
  const options = { session, timestamps: false };
  if (assignedMembershipId && assignedMembershipId !== existing?.assignedMembershipId?.toString()) {
    const member = await WeddingMembership.updateOne({ _id: assignedMembershipId, weddingId }, revision, options);
    if (!member.matchedCount) {
      throw new TaskReferenceUnavailable("assignedMembershipId", "Choose a current member of your wedding.");
    }
  }
  if (eventId && eventId !== existing?.eventId?.toString()) {
    if (!await lockActiveEventReferences(weddingId, [eventId], session)) {
      throw new TaskReferenceUnavailable("eventId", "Choose an active event in your wedding.");
    }
  }
}

async function findCreateReplay(weddingId: string, requestKey: string, session: ClientSession) {
  const scope = { weddingId, requestKey };
  const request = await TaskCreationRequest.findOne(scope).session(session).lean();
  if (!request) return WeddingTask.findOne(scope).session(session).lean();

  const task = await WeddingTask.findOne({ weddingId, _id: request.taskId }).session(session).lean();
  if (!task) throw new TaskCreationGone();
  return task;
}

export async function createTask(weddingId: string, input: TaskValues, requestKey?: string) {
  const database = await prepareTaskStorage();
  const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== "" && value != null));
  const { task, replayed } = await database.transaction(async (session) => {
    if (requestKey) {
      const existing = await findCreateReplay(weddingId, requestKey, session);
      if (existing) return { task: existing, replayed: true };
    }

    const task = new WeddingTask({
      ...fields, weddingId, ...(input.status === "COMPLETED" && { completedAt: new Date() }),
    });
    if (requestKey) await new TaskCreationRequest({ weddingId, requestKey, taskId: task._id }).save({ session });
    await lockNewReferences(weddingId, input, session);
    await task.save({ session });
    return { task, replayed: false };
  }).catch(async (error: unknown) => {
    const duplicate = error as { code?: number; keyPattern?: { requestKey?: number } } | null;
    if (!requestKey || duplicate?.code !== 11000 || duplicate.keyPattern?.requestKey !== 1) throw error;

    const task = await database.transaction((session) => findCreateReplay(weddingId, requestKey, session));
    if (!task) throw error;
    return { task, replayed: true };
  });
  return { task: (await taskDetails(weddingId, [task]))[0], replayed };
}

export async function updateTask(weddingId: string, taskId: string, input: TaskChanges, revision?: number) {
  const database = await connectDatabase();
  const scope = { _id: taskId, weddingId };
  const current = await WeddingTask.findOne(scope).lean();
  if (!current) return null;
  if (revision !== undefined && revision !== (current.__v ?? 0)) throw new TaskConflict();

  const set: Record<string, string | Date> = {};
  const unset: Record<string, 1> = {};
  for (const [field, value] of Object.entries(input)) {
    if (value === null || value === "") unset[field] = 1;
    else if (value !== undefined) set[field] = value;
  }
  if (input.status === "COMPLETED" && current.status !== "COMPLETED") set.completedAt = new Date();
  if (input.status && input.status !== "COMPLETED" && current.status === "COMPLETED") unset.completedAt = 1;

  const updated = await database.transaction(async (session) => {
    await lockNewReferences(weddingId, input, session, current);
    const task = await WeddingTask.findOneAndUpdate({ ...scope, __v: current.__v ?? { $exists: false } },
      { $set: set, $unset: unset, $inc: { __v: 1 } }, { session, returnDocument: "after", runValidators: true }).lean();
    if (!task) throw new TaskConflict();
    return task;
  });
  return (await taskDetails(weddingId, [updated]))[0];
}

export async function deleteTask(weddingId: string, taskId: string, revision?: number) {
  const database = await prepareTaskStorage();
  const scope = { _id: taskId, weddingId };
  return database.transaction(async (session) => {
    const task = await WeddingTask.findOneAndDelete(revision === undefined ? scope : {
      ...scope, __v: revision === 0 ? { $in: [0, null] } : revision,
    }, { session }).select("+requestKey").lean();
    if (!task) {
      if (revision !== undefined && await WeddingTask.exists(scope).session(session)) throw new TaskConflict();
      return false;
    }
    // Older tasks kept their key on the task itself. Preserve it before the deletion commits.
    if (task.requestKey) {
      await new TaskCreationRequest({ weddingId, requestKey: task.requestKey, taskId: task._id }).save({ session });
    }
    return true;
  });
}
