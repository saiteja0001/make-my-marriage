import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { taskDescriptionLimit, taskPriorities, taskStatuses, taskTitleLimit, type TaskPriority, type TaskStatus } from "./validation";

export type TaskRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  title: string;
  description?: string;
  assignedMembershipId?: Types.ObjectId;
  eventId?: Types.ObjectId;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  requestKey?: string;
  __v?: number;
};

const schema = new Schema<TaskRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, maxlength: taskTitleLimit },
  description: { type: String, maxlength: taskDescriptionLimit },
  assignedMembershipId: Schema.Types.ObjectId,
  eventId: Schema.Types.ObjectId,
  dueDate: Date,
  priority: { type: String, enum: Object.keys(taskPriorities), required: true },
  status: { type: String, enum: Object.keys(taskStatuses), required: true },
  completedAt: Date,
  requestKey: { type: String, select: false },
}, { timestamps: true, autoCreate: false, autoIndex: false });

schema.index({ weddingId: 1, createdAt: -1, _id: -1 });
schema.index({ weddingId: 1, dueDate: 1, _id: 1 });
schema.index({ weddingId: 1, status: 1 });
schema.index({ weddingId: 1, assignedMembershipId: 1, status: 1 });
schema.index({ weddingId: 1, eventId: 1 });
schema.index({ weddingId: 1, requestKey: 1 }, {
  unique: true, partialFilterExpression: { requestKey: { $type: "string" } },
});

export const WeddingTask: Model<TaskRecord> = models.WeddingTask ?? model<TaskRecord>("WeddingTask", schema, "tasks");

type TaskCreationRequestRecord = {
  weddingId: Types.ObjectId;
  requestKey: string;
  taskId: Types.ObjectId;
};

const requestSchema = new Schema<TaskCreationRequestRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  requestKey: { type: String, required: true },
  taskId: { type: Schema.Types.ObjectId, required: true },
}, { autoCreate: false, autoIndex: false, versionKey: false });

requestSchema.index({ weddingId: 1, requestKey: 1 }, { unique: true });

export const TaskCreationRequest: Model<TaskCreationRequestRecord> = models.TaskCreationRequest
  ?? model<TaskCreationRequestRecord>("TaskCreationRequest", requestSchema, "task_creation_requests");

let storageReady: Promise<unknown> | undefined;

export async function prepareTaskStorage() {
  const connection = await connectDatabase();
  storageReady ??= Promise.all([WeddingTask.createIndexes(), TaskCreationRequest.createIndexes()]).catch((error: unknown) => {
    storageReady = undefined;
    throw error;
  });
  await storageReady;
  return connection;
}
