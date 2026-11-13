import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/inspect-pdf.mjs <file.pdf>');
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(path));
const pdf = await getDocument({ data }).promise;
console.log(`pages: ${pdf.numPages}`);

let total = 0;
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  total += text.length;
  console.log(
    `page ${pageNumber}: ${text.length} chars` +
      (text ? ` | sample: ${text.slice(0, 160)}` : ' | NO TEXT LAYER'),
  );
}
console.log(`total chars: ${total}`);
