import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalizeSpaces = (value) => value.trim().replace(/\s+/g, " ");
const foldForMatch = (value) =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const guessCategory = (rawName) => {
  const folded = foldForMatch(rawName);
  const compact = normalizeSpaces(rawName);

  if (/\bM(?:[3-9]|[12]\d|30)\b/i.test(compact) || /\bM(?:[3-9]|[12]\d|30)\s*x/i.test(compact)) {
    return "sruby";
  }
  if (folded.includes("mutter") || folded.includes("nakret")) {
    return "nakretki";
  }
  if (folded.includes("scheibe") || folded.includes("unterleg") || folded.includes("podklad")) {
    return "podkladki";
  }
  if (folded.includes("bolzen") || folded.includes("splint") || folded.includes("sicherungsblech")) {
    return "bolce";
  }
  if (folded.includes("gummi") || folded.includes("gumm") || folded.includes("dichtung") || folded.includes("o-ring") || folded.includes("oring")) {
    return "gumy";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("stecker") ||
    folded.includes("schalter") ||
    folded.includes("relais") ||
    folded.includes("sicherung") ||
    folded.includes("klemme") ||
    folded.includes("kabelbinder") ||
    folded.includes("isolier")
  ) {
    return "elektryka";
  }
  if (
    folded.includes("hydraul") ||
    folded.includes("schlauch") ||
    folded.includes("ventil") ||
    folded.includes("zylinder") ||
    folded.includes("kupplung") ||
    folded.includes("drossel") ||
    folded.includes("manometer") ||
    folded.includes("fitting")
  ) {
    return "hydraulika";
  }
  return "inne";
};

const normalizeCategory = (value) => {
  const cleaned = normalizeSpaces(value).toLowerCase();
  if (!cleaned) return "inne";
  if (cleaned === "inne inne") return "inne";
  const tokens = cleaned.split(" ").filter(Boolean);
  const unique = new Set(tokens);
  if (unique.size === 1) return tokens[0];
  return cleaned;
};

const main = async () => {
  const parts = await prisma.part.findMany({
    select: { id: true, name: true, category: true },
  });

  let updated = 0;
  for (const part of parts) {
    const nextCategory = normalizeCategory(guessCategory(part.name));
    const current = part.category ? normalizeCategory(part.category) : "";
    if (nextCategory !== current) {
      await prisma.part.update({
        where: { id: part.id },
        data: { category: nextCategory },
      });
      updated += 1;
    }
  }

  console.log(`Updated categories: ${updated} / ${parts.length}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
