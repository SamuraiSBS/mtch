import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type Role = "SPECIALIST" | "EMPLOYER";
const registrationRole = new AsyncLocalStorage<Role>();
export function withRegistrationRole<T>(role: Role, action: () => Promise<T>) { return registrationRole.run(role, action); }

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  user: { additionalFields: { role: { type: ["SPECIALIST", "EMPLOYER"], required: false, input: false } } },
  databaseHooks: { user: {
    create: { before: async (newUser) => {
      const role = registrationRole.getStore();
      if (!role) throw new Error("Registration role missing");
      return { data: { ...newUser, role } };
    } },
    update: { before: async (data) => {
      if ("role" in data) throw new Error("Role is immutable");
      return { data };
    } },
  } },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
});
