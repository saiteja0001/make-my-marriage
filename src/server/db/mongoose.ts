import "server-only";
import mongoose, { type Connection } from "mongoose";

const database = globalThis as typeof globalThis & {
  marriageConnection?: Promise<Connection>;
};

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Missing MongoDB configuration");

  database.marriageConnection ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(({ connection }) => connection)
    .catch((error: unknown) => {
      delete database.marriageConnection;
      throw error;
    });

  return database.marriageConnection;
}
