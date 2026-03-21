import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_EMAIL ?? "pablo@entrenamientos.local";
  const password = process.env.SEED_PASSWORD ?? "changeme123";
  const name = process.env.SEED_NAME ?? "Pablo";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario ya existe: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, password: hash },
  });

  console.log(`Usuario creado: ${user.email} (id: ${user.id})`);
  console.log("Recuerda cambiar la contraseña después del primer login.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
