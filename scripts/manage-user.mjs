import { emitKeypressEvents } from "node:readline";
import { PrismaClient } from "../generated/prisma/index.js";
import { hashPassword } from "../src/server/auth/password.mjs";

const remove = process.argv[2] === "--delete";
const username = process.argv[remove ? 3 : 2]?.trim();
if (!username || username.length > 100) {
  console.error("Usage: npm run auth:user -- <username>\n       npm run auth:user -- --delete <username>");
  process.exit(1);
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk;
    return value.replace(/\r?\n$/, "");
  }
  process.stderr.write("Password (at least 12 characters): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    /** @param {string} character @param {{ name?: string; ctrl?: boolean }} key */
    function onKey(character, key) {
      if (key.name === "return" || (key.ctrl && key.name === "c")) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("keypress", onKey);
        process.stderr.write("\n");
        if (key.ctrl) reject(new Error("Cancelled"));
        else resolve(value);
      } else if (key.name === "backspace") value = value.slice(0, -1);
      else if (character && !key.ctrl) value += character;
    }
    process.stdin.on("keypress", onKey);
  });
}

const db = new PrismaClient();
try {
  if (remove) {
    await db.user.delete({ where: { username } });
    console.log(`Removed ${username} and revoked their sessions.`);
  } else {
    const password = await readPassword();
    if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
      throw new Error("Password must contain 12–1024 characters.");
    }
    const passwordHash = await hashPassword(password);
    await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { username }, create: { username, passwordHash }, update: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    console.log(`Saved ${username}. Existing sessions for this user were revoked.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to update account.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
