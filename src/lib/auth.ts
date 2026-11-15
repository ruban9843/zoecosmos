import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
};

export type AppSession = { user: AppUser };

/**
 * Resolve the Clerk session to the application's user and role record.
 * The email fallback links a pre-existing Prisma record on first Clerk sign-in.
 */
export async function auth(): Promise<AppSession | null> {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) throw new Error("The signed-in Clerk user has no primary email address.");

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  const image = clerkUser.imageUrl || null;
  const existing = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { email, name, image },
      })
    : await prisma.user.upsert({
        where: { email },
        update: { clerkUserId: userId, name, image },
        create: { clerkUserId: userId, email, name, image },
      });
  const configuredOwnerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const role =
    configuredOwnerEmail
      ? email === configuredOwnerEmail
        ? "OWNER"
        : user.role === "OWNER"
          ? "CUSTOMER"
          : user.role
      : user.role;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role,
    },
  };
}
