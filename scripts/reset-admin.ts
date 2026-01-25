import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";

async function resetAdmin() {
  const email = "admin@doogoodscoopers.com";
  const newPassword = "DooGood2024!";
  const hash = await bcrypt.hash(newPassword, 12);

  try {
    // Try to update existing user
    const user = await prisma.adminUser.update({
      where: { email },
      data: { passwordHash: hash },
    });
    console.log("Password reset successful for:", user.email);
  } catch {
    // User doesn't exist, create them
    const user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: hash,
        name: "Admin",
      },
    });
    console.log("Admin user created:", user.email);
  }

  process.exit(0);
}

resetAdmin();
