import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    databaseHooks: {
        session: {
            create: {
                // BR-008: frozen/inactive users never get a usable session.
                before: async (session) => {
                    const user = await prisma.user.findUnique({
                        where: { id: session.userId },
                        select: { isActive: true, isFrozen: true },
                    });
                    if (user?.isFrozen) {
                        throw new APIError("FORBIDDEN", {
                            message: "Akun Anda sedang dibekukan. Hubungi administrator.",
                        });
                    }
                    if (user && user.isActive === false) {
                        throw new APIError("FORBIDDEN", {
                            message: "Akun Anda tidak aktif. Hubungi administrator.",
                        });
                    }
                },
            },
        },
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "mahasiswa", // admin | dosen | mahasiswa
                // Client-supplied role is ignored on signup and rejected on
                // profile update. Elevated roles are only set by audited admin flows.
                input: false,
            },
            isActive: {
                type: "boolean",
                required: false,
                defaultValue: true,
                input: false,
            },
            isFrozen: {
                type: "boolean",
                required: false,
                defaultValue: false,
                input: false,
            },
            academicLevel: {
                type: "string",
                required: false,
                defaultValue: null, // S1 | S2 | S3 — hanya untuk mahasiswa
            },
            npm: {
                type: "string",
                required: false,
                defaultValue: null, // Nomor Pokok Mahasiswa — hanya untuk mahasiswa
            },
            major: {
                type: "string",
                required: false,
                defaultValue: null, // jurusan
            },
            faculty: {
                type: "string",
                required: false,
                defaultValue: null, // fakultas
            },
            bio: {
                type: "string",
                required: false,
                defaultValue: null,
            },
        },
    },
});