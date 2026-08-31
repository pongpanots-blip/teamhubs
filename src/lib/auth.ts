import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {},
  },
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    // Dev servers frequently end up on a different port than whatever is
    // baked into BETTER_AUTH_URL (the configured port already taken, a
    // different machine, etc). Trust any localhost port outside production
    // rather than hardcoding one and breaking auth every time it drifts.
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:*"] : []),
  ],
});

export type Session = typeof auth.$Infer.Session;
