import type { NextAuthConfig } from "next-auth";

/**
 * Configuración mínima de NextAuth compatible con Edge Runtime.
 * Usada exclusivamente en middleware.ts para verificar sesiones JWT.
 * No contiene ninguna importación de Node.js (sin Prisma, sin bcrypt).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
