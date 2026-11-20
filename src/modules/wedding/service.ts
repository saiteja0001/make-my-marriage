import "server-only";
import { randomBytes } from "node:crypto";
import { connectDatabase } from "@/server/db/mongoose";
import { connectWeddingStorage, Wedding, WeddingMembership } from "./models";
import type { WeddingCreation } from "./validation";

export class AlreadyHasWedding extends Error {}

function slugFor({ brideName, groomName, weddingDate }: WeddingCreation) {
  const names = `${brideName} ${groomName}`.normalize("NFKD").toLowerCase()
    .replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-")
    .slice(0, 90).replace(/^-+|-+$/g, "");
  return `${names || "wedding"}-${weddingDate.split("-").reverse().join("")}`;
}

function duplicateIndex(error: unknown, index: string) {
  const duplicate = error as { code?: number; keyPattern?: Record<string, number> } | null;
  return duplicate?.code === 11000 && duplicate.keyPattern?.[index] === 1;
}

export async function hasWeddingMembership(userId: string) {
  await connectDatabase();
  return Boolean(await WeddingMembership.exists({ userId }));
}

export async function getWeddingForUser(userId: string) {
  await connectDatabase();
  const membership = await WeddingMembership.findOne({ userId }).select("role weddingId").lean().exec();
  if (!membership) return null;

  const wedding = await Wedding.findById(membership.weddingId)
    .select("brideName groomName title description weddingDate timeZone location.formattedAddress")
    .lean().exec();
  if (!wedding) throw new Error("Wedding membership could not be resolved.");

  const { _id, ...details } = wedding;
  return { membership: { role: membership.role }, wedding: { id: _id.toString(), ...details } };
}

export async function createWedding(userId: string, input: WeddingCreation) {
  const connection = await connectWeddingStorage();
  const baseSlug = slugFor(input);

  // Keep the first slug readable and retry collisions with a suffix. Every retry owns a new transaction.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomBytes(4).toString("hex")}`;
    try {
      return await connection.transaction(async (transaction) => {
        if (await WeddingMembership.exists({ userId }).session(transaction)) throw new AlreadyHasWedding();

        const wedding = await new Wedding({
          ...input,
          title: input.title || undefined,
          description: input.description || undefined,
          website: { slug },
          createdByUserId: userId,
        }).save({ session: transaction });

        await new WeddingMembership({ userId, weddingId: wedding._id, role: "ADMIN", joinedAt: new Date() })
          .save({ session: transaction });

        return {
          id: wedding._id.toString(),
          brideName: wedding.brideName,
          groomName: wedding.groomName,
          weddingDate: wedding.weddingDate,
          website: { slug },
        };
      });
    } catch (error) {
      if (duplicateIndex(error, "userId")) throw new AlreadyHasWedding();
      if (!duplicateIndex(error, "website.slug") || attempt === 3) throw error;
    }
  }

  throw new Error("Could not reserve a wedding slug.");
}
