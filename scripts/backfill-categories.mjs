import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalizeSpaces = (value) => value.trim().replace(/\s+/g, " ");
const foldForMatch = (value) =>
  value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const guessCategory = (rawName) => {
  const folded = foldForMatch(rawName);
  const compact = normalizeSpaces(rawName);
  const isMutter = folded.includes("mutter") || folded.includes("nakret");
  const isScheibe = folded.includes("scheibe") || folded.includes("unterleg") || folded.includes("podklad");
  const isZylinder =
    folded.includes("zylinder") ||
    folded.includes("zyl.") ||
    folded.includes("cylinder") ||
    folded.includes("buchse");
  const isSchlauch =
    folded.includes("schlauch") ||
    folded.includes("schlauchleitung") ||
    folded.includes("schlauchschelle") ||
    folded.includes("schlauchschellen") ||
    folded.includes("schlauschelle") ||
    folded.includes("schlauschellen") ||
    folded.includes("schlauche") ||
    folded.includes("schlaeuch") ||
    folded.includes("schluch") ||
    folded.includes("schluchleitung") ||
    folded.includes("sclauch") ||
    folded.includes("sclauche");
  const hasScrewSize =
    /\bM(?:[3-9]|[12]\d|30)\b/i.test(compact) || /\bM(?:[3-9]|[12]\d|30)\s*x/i.test(compact);

  if (isZylinder) {
    return "cylindry";
  }
  if (isSchlauch) {
    return "weze";
  }
  if (
    folded.includes("hydraul") ||
    folded.includes("ventil") ||
    folded.includes("kupplung") ||
    folded.includes("drossel") ||
    folded.includes("manometer") ||
    folded.includes("fitting")
  ) {
    return "hydraulika";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("lampe") ||
    folded.includes("leuchte") ||
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
  if (folded.includes("bolzen") || folded.includes("splint") || folded.includes("sicherungsblech") || folded.includes("link pin") || folded.includes("lower link pin") || folded.includes("top link pin") || /\bpin\b/.test(folded)) {
    return "bolce";
  }
  if (folded.includes("warnflag") || folded.includes("flaga")) {
    return "bolce";
  }
  if (isMutter) {
    return "nakretki";
  }
  if (isScheibe) {
    return "podkladki";
  }
  if (!isMutter && !isScheibe && (folded.includes("schraub") || hasScrewSize)) {
    return "sruby";
  }
  if (folded.includes("gummi") || folded.includes("gumm") || folded.includes("dichtung") || folded.includes("o-ring") || folded.includes("oring")) {
    return "gumy";
  }
  if (
    folded.includes("schmiernippel") ||
    folded.includes("smarownicz") ||
    folded.includes("dokument") ||
    folded.includes("doku")
  ) {
    return "inne";
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
  let srubyToNakretki = 0;
  let srubyToPodkladki = 0;
  let srubyToCylindry = 0;
  let srubyToWeze = 0;
  let hydraulikaToCylindry = 0;
  let hydraulikaToWeze = 0;
  const srubyToNakretkiExamples = [];
  const srubyToPodkladkiExamples = [];
  const srubyToCylindryExamples = [];
  const srubyToWezeExamples = [];
  const hydraulikaToCylindryExamples = [];
  const hydraulikaToWezeExamples = [];

  for (const part of parts) {
    const nextCategory = normalizeCategory(guessCategory(part.name));
    const current = part.category ? normalizeCategory(part.category) : "";
    const isAutoCandidate = !current || current === "sruby";
    const isScrewCorrection =
      current === "sruby" &&
      (nextCategory === "nakretki" ||
        nextCategory === "podkladki" ||
        nextCategory === "cylindry" ||
        nextCategory === "weze");
    const isHydraulikaCorrection =
      current === "hydraulika" && (nextCategory === "cylindry" || nextCategory === "weze");

    if (!isAutoCandidate && !isScrewCorrection && !isHydraulikaCorrection) {
      continue;
    }

    if (nextCategory !== current) {
      await prisma.part.update({
        where: { id: part.id },
        data: { category: nextCategory },
      });
      updated += 1;
      if (current === "sruby" && nextCategory === "nakretki") {
        srubyToNakretki += 1;
        if (srubyToNakretkiExamples.length < 5) {
          srubyToNakretkiExamples.push(part.name);
        }
      }
      if (current === "sruby" && nextCategory === "podkladki") {
        srubyToPodkladki += 1;
        if (srubyToPodkladkiExamples.length < 5) {
          srubyToPodkladkiExamples.push(part.name);
        }
      }
      if (current === "sruby" && nextCategory === "cylindry") {
        srubyToCylindry += 1;
        if (srubyToCylindryExamples.length < 5) {
          srubyToCylindryExamples.push(part.name);
        }
      }
      if (current === "sruby" && nextCategory === "weze") {
        srubyToWeze += 1;
        if (srubyToWezeExamples.length < 5) {
          srubyToWezeExamples.push(part.name);
        }
      }
      if (current === "hydraulika" && nextCategory === "cylindry") {
        hydraulikaToCylindry += 1;
        if (hydraulikaToCylindryExamples.length < 5) {
          hydraulikaToCylindryExamples.push(part.name);
        }
      }
      if (current === "hydraulika" && nextCategory === "weze") {
        hydraulikaToWeze += 1;
        if (hydraulikaToWezeExamples.length < 5) {
          hydraulikaToWezeExamples.push(part.name);
        }
      }
    }
  }

  console.log(`Updated categories: ${updated} / ${parts.length}`);
  console.log(`Sruby -> Nakretki: ${srubyToNakretki}`);
  if (srubyToNakretkiExamples.length) {
    console.log(`Examples (Nakretki): ${srubyToNakretkiExamples.join(" | ")}`);
  }
  console.log(`Sruby -> Podkladki: ${srubyToPodkladki}`);
  if (srubyToPodkladkiExamples.length) {
    console.log(`Examples (Podkladki): ${srubyToPodkladkiExamples.join(" | ")}`);
  }
  console.log(`Sruby -> Cylindry: ${srubyToCylindry}`);
  if (srubyToCylindryExamples.length) {
    console.log(`Examples (Cylindry): ${srubyToCylindryExamples.join(" | ")}`);
  }
  console.log(`Sruby -> Weze: ${srubyToWeze}`);
  if (srubyToWezeExamples.length) {
    console.log(`Examples (Weze): ${srubyToWezeExamples.join(" | ")}`);
  }
  console.log(`Hydraulika -> Cylindry: ${hydraulikaToCylindry}`);
  if (hydraulikaToCylindryExamples.length) {
    console.log(`Examples (Cylindry, from Hydraulika): ${hydraulikaToCylindryExamples.join(" | ")}`);
  }
  console.log(`Hydraulika -> Weze: ${hydraulikaToWeze}`);
  if (hydraulikaToWezeExamples.length) {
    console.log(`Examples (Weze, from Hydraulika): ${hydraulikaToWezeExamples.join(" | ")}`);
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

