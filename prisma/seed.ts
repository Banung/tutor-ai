import { auth } from "../src/lib/auth";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Seeding database...");

  const users = [
    { email: "admin@mail.unpad.ac.id", password: "password", name: "Administrator", role: "admin" },
    { email: "dosen@mail.unpad.ac.id", password: "password", name: "Dr. Budi Santoso", role: "dosen" },
    { 
      email: "mahasiswaS1@mail.unpad.ac.id", 
      password: "password", 
      name: "Andi Pratama", 
      role: "mahasiswa",
      academicLevel: "S1",
      npm: "140810200001",
      major: "Teknik Informatika",
      faculty: "MIPA"
    },
    { 
      email: "mahasiswaS2@mail.unpad.ac.id", 
      password: "password", 
      name: "Siti Aminah", 
      role: "mahasiswa",
      academicLevel: "S2",
      npm: "140820230005",
      major: "Ilmu Komputer",
      faculty: "MIPA"
    },
    { 
      email: "mahasiswaS3@mail.unpad.ac.id", 
      password: "password", 
      name: "Dr. Ahmad Hidayat", 
      role: "mahasiswa",
      academicLevel: "S3",
      npm: "170130240010",
      major: "Hukum",
      faculty: "Hukum"
    },
  ];

  for (const user of users) {
    // Better Auth stores emails lowercased, so look up the normalized form to stay idempotent.
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email.toLowerCase() },
    });

    if (!existingUser) {
      console.log(`Creating user: ${user.email} (Role: ${user.role})`);
      
      const response = await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.name,
        },
      });

      if (response?.user) {
        // Update the custom fields
        await prisma.user.update({
          where: { id: response.user.id },
          data: { 
            role: user.role,
            academicLevel: (user as any).academicLevel || null,
            npm: (user as any).npm || null,
            major: (user as any).major || null,
            faculty: (user as any).faculty || null,
          },
        });
        console.log(`Successfully created ${user.email}`);
      } else {
        console.error(`Failed to create ${user.email}`, response);
      }
    } else {
      console.log(`User ${user.email} already exists. Skipping.`);
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
