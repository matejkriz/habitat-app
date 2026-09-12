import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const outputDirectory = join(projectRoot, "public", "startup", "ios");

const profiles = [
  { width: 320, height: 568, pixelRatio: 2, safeTop: 20, safeBottom: 0 },
  { width: 375, height: 667, pixelRatio: 2, safeTop: 20, safeBottom: 0 },
  { width: 414, height: 736, pixelRatio: 3, safeTop: 20, safeBottom: 0 },
  { width: 375, height: 812, pixelRatio: 3, safeTop: 47, safeBottom: 34 },
  { width: 414, height: 896, pixelRatio: 2, safeTop: 44, safeBottom: 34 },
  { width: 414, height: 896, pixelRatio: 3, safeTop: 44, safeBottom: 34 },
  { width: 390, height: 844, pixelRatio: 3, safeTop: 47, safeBottom: 34 },
  { width: 428, height: 926, pixelRatio: 3, safeTop: 47, safeBottom: 34 },
  { width: 393, height: 852, pixelRatio: 3, safeTop: 59, safeBottom: 34 },
  { width: 430, height: 932, pixelRatio: 3, safeTop: 59, safeBottom: 34 },
  { width: 402, height: 874, pixelRatio: 3, safeTop: 62, safeBottom: 34 },
  { width: 440, height: 956, pixelRatio: 3, safeTop: 62, safeBottom: 34 },
  { width: 420, height: 912, pixelRatio: 3, safeTop: 62, safeBottom: 34 },
];

const colors = {
  cream: "#FDF8F3",
  creamDark: "#F5EDE3",
  white: "#FFFFFF",
  gold: "#D4A84B",
  goldSoft: "#FBF7ED",
  charcoal: "#3D3D3D",
  charcoalLight: "#737373",
};

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function cardMarkup(width, y) {
  const innerWidth = width - 80;

  return `
    <rect x="16" y="${y}" width="${width - 32}" height="160" rx="12" fill="${colors.white}" stroke="${colors.creamDark}"/>
    <rect x="40" y="${y + 24}" width="128" height="20" rx="4" fill="${colors.creamDark}"/>
    <rect x="40" y="${y + 64}" width="${innerWidth}" height="16" rx="4" fill="${colors.creamDark}" fill-opacity="0.7"/>
    <rect x="40" y="${y + 92}" width="${Math.round(innerWidth * 0.8)}" height="16" rx="4" fill="${colors.creamDark}" fill-opacity="0.7"/>
  `;
}

function launchSvg(profile, logoDataUri) {
  const { width, height, safeTop, safeBottom } = profile;
  const headerBottom = safeTop + 64;
  const navTop = height - 64 - safeBottom;
  const firstCardTop = headerBottom + 100;
  const cards = [];

  for (let y = firstCardTop; y < navTop; y += 184) {
    cards.push(cardMarkup(width, y));
  }

  const firstTabCenter = width / 4;
  const secondTabCenter = (width * 3) / 4;
  const activeTabWidth = width / 2 - 8;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${colors.cream}"/>

      <rect width="${width}" height="${headerBottom}" fill="${colors.white}"/>
      <rect y="${headerBottom - 1}" width="${width}" height="1" fill="${colors.creamDark}"/>
      <image href="${escapeXml(logoDataUri)}" x="16" y="${safeTop + 16}" width="98.56" height="32" preserveAspectRatio="xMinYMid meet"/>
      <circle cx="${width - 36}" cy="${safeTop + 32}" r="20" fill="${colors.creamDark}" stroke="${colors.gold}" stroke-opacity="0.25"/>

      <rect x="16" y="${headerBottom + 24}" width="160" height="28" rx="4" fill="${colors.creamDark}"/>
      <rect x="16" y="${headerBottom + 60}" width="224" height="16" rx="4" fill="${colors.creamDark}" fill-opacity="0.7"/>
      ${cards.join("")}

      <rect y="${navTop}" width="${width}" height="${64 + safeBottom}" fill="${colors.white}"/>
      <rect y="${navTop}" width="${width}" height="1" fill="${colors.creamDark}"/>
      <rect x="4" y="${navTop + 4}" width="${activeTabWidth}" height="56" rx="8" fill="${colors.goldSoft}"/>

      <g transform="translate(${firstTabCenter - 10} ${navTop + 8})" fill="none" stroke="${colors.gold}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 10 10 2l9 8"/>
        <path d="M3 9v9h5v-5h4v5h5V9"/>
      </g>
      <text x="${firstTabCenter}" y="${navTop + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="${colors.charcoal}">Přehled</text>

      <g transform="translate(${secondTabCenter - 10} ${navTop + 8})" fill="none" stroke="${colors.charcoalLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 2h7l4 4v12H5z"/>
        <path d="M12 2v5h4M8 11h5M8 15h5"/>
      </g>
      <text x="${secondTabCenter}" y="${navTop + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="${colors.charcoalLight}">Omluvenka</text>
    </svg>
  `;
}

await mkdir(outputDirectory, { recursive: true });

const logoSource = await readFile(
  join(projectRoot, "public", "habitat-logo.webp"),
);
const logo = await sharp(logoSource).png().toBuffer();
const logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;

await Promise.all(
  profiles.map(async (profile) => {
    const physicalWidth = profile.width * profile.pixelRatio;
    const physicalHeight = profile.height * profile.pixelRatio;
    const target = join(
      outputDirectory,
      `habitat-v1-${physicalWidth}x${physicalHeight}.png`,
    );

    await sharp(Buffer.from(launchSvg(profile, logoDataUri)), {
      density: 72 * profile.pixelRatio,
    })
      .flatten({ background: colors.cream })
      .removeAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toFile(target);
  }),
);

console.log(`Generated ${profiles.length} iOS startup images in ${outputDirectory}`);
