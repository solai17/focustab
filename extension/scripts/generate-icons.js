import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const sizes = [16, 48, 128];

async function generateIcons() {
  const svgBuffer = readFileSync(join(iconsDir, 'icon.svg'));
  
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon${size}.png`));
    
    console.log(`Generated icon${size}.png`);
  }
  
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
