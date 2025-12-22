import sharp from 'sharp';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const sizes = [16, 48, 128];

async function generateIcons() {
  // Use 256px PNG as source (higher quality than SVG conversion)
  const sourcePath = join(iconsDir, 'icon256.png');

  if (!existsSync(sourcePath)) {
    console.error('Source icon (icon256.png) not found!');
    process.exit(1);
  }

  for (const size of sizes) {
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(iconsDir, `icon${size}.png`));

    console.log(`Generated icon${size}.png`);
  }

  console.log('All icons generated from icon256.png!');
}

generateIcons().catch(console.error);
