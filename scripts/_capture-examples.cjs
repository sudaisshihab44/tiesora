const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'https://tiesora-alpha.vercel.app';
const OUT_DIR = path.join(process.cwd(), 'docs', 'relationship-examples');

const examples = [
  { file: '01-father.jpg', expected: 'Father', a: '827fb95b-8068-430b-b79c-870200a99108', aName: 'Ayesha Bi', b: 'b06a99c2-102c-4107-a37a-fd3427f83ce3', bName: 'Mohd. Hashim' },
  { file: '02-mother.jpg', expected: 'Mother', a: '0a1b774d-015a-4fb8-b34a-68cdb9c33f83', aName: 'Jaleel', b: '12589a65-3417-47b0-a7f8-73163cf01d31', bName: 'Tahseen' },
  { file: '03-son.jpg', expected: 'Son', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: 'a999c914-1a02-405d-9bbb-5309454cd0a0', bName: 'Abdul Latheef' },
  { file: '04-daughter.jpg', expected: 'Daughter', a: 'a9dd5712-0535-45cb-ac9e-6d5fbbdb9cc5', aName: 'Abdul Hameed', b: 'baf6b447-f7b8-487a-ade7-0f8a34cb7180', bName: 'Qhadija Bi' },
  { file: '05-grandfather.jpg', expected: 'Grandfather', a: 'e9f0ea48-03c1-41d0-8b2c-a152537df535', aName: 'Sabiha (d/o Nawab)', b: 'd2016405-a0d4-45a2-96e4-bfdf7adb251d', bName: 'Fazlulla Sharif' },
  { file: '06-grandmother.jpg', expected: 'Grandmother', a: 'fe0584e7-388a-40bf-8d70-3e1e6b2d74c2', aName: 'Badar', b: '6a36d2ff-a706-4e0a-a17d-14346e267a82', bName: 'Zakera Khatoon' },
  { file: '07-grandson.jpg', expected: 'Grandson', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: '36a61b4b-c1aa-44df-a826-39f96b0150bc', bName: 'Lala Mian' },
  { file: '08-granddaughter.jpg', expected: 'Granddaughter', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: 'baf6b447-f7b8-487a-ade7-0f8a34cb7180', bName: 'Qhadija Bi' },
  { file: '09-great-grandson.jpg', expected: 'Great-Grandson', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: '58c5a311-11bc-4fff-8343-de1f20bce433', bName: 'Abdul Qhader Shariff' },
  { file: '10-great-granddaughter.jpg', expected: 'Great-Granddaughter', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: '2486df55-c1ea-4abd-ae43-92a1def2f736', bName: 'Qhader Bi' },
  { file: '11-brother.jpg', expected: 'Brother', a: '3eb5ac86-c303-4f27-ba5e-f0cf4f27de53', aName: 'Hajira Masroor', b: 'f87456fc-1edc-4dd4-9a68-944dfca38cc0', bName: 'Sadiq Hussain' },
  { file: '12-sister.jpg', expected: 'Sister', a: '5c1cf303-239c-4e7b-bd75-4adb2fed82cc', aName: 'Naseebunnisa', b: '30e75b07-38f5-4904-b6ff-6e4b4ad417cb', bName: 'Azeeza Arif' },
  { file: '13-nephew.jpg', expected: 'Nephew', a: 'a999c914-1a02-405d-9bbb-5309454cd0a0', aName: 'Abdul Latheef', b: '3101b04b-9422-41b7-b66e-1309bf9d5971', bName: 'Syed Yousuf' },
  { file: '14-niece.jpg', expected: 'Niece', a: 'a999c914-1a02-405d-9bbb-5309454cd0a0', aName: 'Abdul Latheef', b: 'baf6b447-f7b8-487a-ade7-0f8a34cb7180', bName: 'Qhadija Bi' },
  { file: '15-first-cousin.jpg', expected: 'First Cousin', a: '36a61b4b-c1aa-44df-a826-39f96b0150bc', aName: 'Lala Mian', b: '3101b04b-9422-41b7-b66e-1309bf9d5971', bName: 'Syed Yousuf' },
  { file: '16-second-cousin.jpg', expected: 'Second Cousin', a: '58c5a311-11bc-4fff-8343-de1f20bce433', aName: 'Abdul Qhader Shariff', b: '20ecfa49-d78c-4a98-a872-a42a823f1667', bName: 'Azmathullah Khan Miyan' },
  { file: '17-first-cousin-once-removed.jpg', expected: 'First Cousin Once Removed', a: '36a61b4b-c1aa-44df-a826-39f96b0150bc', aName: 'Lala Mian', b: '20ecfa49-d78c-4a98-a872-a42a823f1667', bName: 'Azmathullah Khan Miyan' },
  { file: '18-husband.jpg', expected: 'Husband', a: '2486df55-c1ea-4abd-ae43-92a1def2f736', aName: 'Qhader Bi', b: '02655786-194d-4b8b-9d60-ce482b3ffb43', bName: 'Ghulam Mohiuddin Khan' },
  { file: '19-wife.jpg', expected: 'Wife', a: '8717da06-0a07-400a-b09a-3b0f07f16589', aName: 'Abdul Wahab Khan', b: 'addcf21f-1684-4e0d-b597-048001912de5', bName: 'Rabia Bi' },
  { file: '20-father-in-law.jpg', expected: 'Father-in-Law', a: '2486df55-c1ea-4abd-ae43-92a1def2f736', aName: 'Qhader Bi', b: 'f01c1e56-1037-4ab4-87ac-ec169a0ed579', bName: 'Ghulam Masood Khan' },
  { file: '21-mother-in-law.jpg', expected: 'Mother-in-Law', a: '5f7fb571-a9c9-48b3-ae58-5df5b3893d21', aName: 'Zamira Khanum', b: '12589a65-3417-47b0-a7f8-73163cf01d31', bName: 'Tahseen' },
  { file: '22-son-in-law.jpg', expected: 'Son-in-Law', a: '36a61b4b-c1aa-44df-a826-39f96b0150bc', aName: 'Lala Mian', b: '02655786-194d-4b8b-9d60-ce482b3ffb43', bName: 'Ghulam Mohiuddin Khan' },
  { file: '23-daughter-in-law.jpg', expected: 'Daughter-in-Law', a: '28a66db0-a351-461f-b5a4-5da68a0d1a01', aName: 'Saleha Khanum', b: 'b3b04cb6-bb2e-4682-a9c9-6f9d99335447', bName: 'Nahida Tabassumf' },
  { file: '24-brother-in-law.jpg', expected: 'Brother-in-Law', a: '58c5a311-11bc-4fff-8343-de1f20bce433', aName: 'Abdul Qhader Shariff', b: '02655786-194d-4b8b-9d60-ce482b3ffb43', bName: 'Ghulam Mohiuddin Khan' },
  { file: '25-sister-in-law.jpg', expected: 'Sister-in-Law', a: '3eb5ac86-c303-4f27-ba5e-f0cf4f27de53', aName: 'Hajira Masroor', b: 'b3b04cb6-bb2e-4682-a9c9-6f9d99335447', bName: 'Nahida Tabassumf' },
  { file: '26-step-mother.jpg', expected: 'Step-Mother', a: '827fb95b-8068-430b-b79c-870200a99108', aName: 'Ayesha Bi', b: '80877dba-caac-4eec-8636-1c7f4be5edb0', bName: 'Majoo Bi Bi' },
  { file: '27-step-father.jpg', expected: 'Step-Father', a: 'b25b6b46-840b-4ae8-bda8-bef85cf5596c', aName: 'Raziya', b: '0914d88e-059a-42a8-975d-81ed2b7c58f3', bName: 'Majid Hussain' },
  { file: '28-step-son.jpg', expected: 'Step-Son', a: '0c004b8c-20d4-46ed-b152-93a159b02cf4', aName: 'Zahara Khatoon', b: '23d255d7-b7f2-4637-adaf-8fc62eb2dd4f', bName: 'Saad Mohd. Shariff' },
  { file: '29-step-daughter.jpg', expected: 'Step-Daughter', a: 'f1be5d06-2b15-49d0-8bd5-3d14f7d64a58', aName: 'Rabia Bi (d/o Abdul Qhader)', b: 'f4f7a90f-9350-4e2a-9738-311b0f14b1d0', bName: 'Amtul Aleem' },
  { file: '30-step-brother.jpg', expected: 'Step-Brother', a: 'c65206ed-5dcb-4fb0-b98c-eaa2fce14b24', aName: 'Sana Farheen', b: '23d255d7-b7f2-4637-adaf-8fc62eb2dd4f', bName: 'Saad Mohd. Shariff' },
  { file: '31-step-sister.jpg', expected: 'Step-Sister', a: 'c65206ed-5dcb-4fb0-b98c-eaa2fce14b24', aName: 'Sana Farheen', b: '3c7638ca-311d-4200-8dd3-b302f9f2937c', bName: 'Sara Almas' },
  { file: '32-adoptive-father.jpg', expected: 'Adoptive Father', a: '02655786-194d-4b8b-9d60-ce482b3ffb43', aName: 'Ghulam Mohiuddin Khan', b: 'f01c1e56-1037-4ab4-87ac-ec169a0ed579', bName: 'Ghulam Masood Khan' },
  { file: '33-aunt-uncle.jpg', expected: 'Aunt/Uncle', a: 'e9f0ea48-03c1-41d0-8b2c-a152537df535', aName: 'Sabiha (d/o Nawab)', b: '367a180b-1c48-4bfa-ae7d-07044da12b05', bName: 'Mehrun' },
  { file: '34-grandnephew.jpg', expected: 'Grandnephew', a: 'a999c914-1a02-405d-9bbb-5309454cd0a0', aName: 'Abdul Latheef', b: '20ecfa49-d78c-4a98-a872-a42a823f1667', bName: 'Azmathullah Khan Miyan' },
  { file: '35-aunt-in-law.jpg', expected: 'Aunt-in-Law', a: 'c65206ed-5dcb-4fb0-b98c-eaa2fce14b24', aName: 'Sana Farheen', b: 'df80900b-c3c3-46ab-b049-1c2593cb39d4', bName: 'Naheeda Khatoon' },
  { file: '36-niece-in-law.jpg', expected: 'Niece-in-Law', a: '02655786-194d-4b8b-9d60-ce482b3ffb43', aName: 'Ghulam Mohiuddin Khan', b: 'f1be5d06-2b15-49d0-8bd5-3d14f7d64a58', bName: 'Rabia Bi (d/o Abdul Qhader)' },
  { file: '37-extended.jpg', expected: 'Extended Family Connection', a: 'f511347a-2c33-4cdf-9b03-69ec573f9b86', aName: 'Darvesh Mohammed', b: '02655786-194d-4b8b-9d60-ce482b3ffb43', bName: 'Ghulam Mohiuddin Khan' },
  { file: '38-incomplete.jpg', expected: 'No Verified Relationship Found', a: 'a999c914-1a02-405d-9bbb-5309454cd0a0', aName: 'Abdul Latheef', b: '847d21c4-594e-42be-b0b0-e200cb9795d4', bName: 'Maher' },
  { file: '39-ambiguous-sibling.jpg', expected: 'Brother', a: 'a999c914-1a02-405d-9bbb-5309454cd0a0', aName: 'Abdul Latheef', b: 'a9dd5712-0535-45cb-ac9e-6d5fbbdb9cc5', bName: 'Abdul Hameed' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 200)); });
  page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`));

  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle', timeout: 90000 });
  const signIn = page.getByRole('button', { name: 'Sign In', exact: true }).first();
  if (await signIn.count()) await signIn.click();
  await page.getByText('Choose how you').waitFor({ timeout: 20000 }).catch(() => {});
  const adminLogin = page.getByRole('button', { name: /Admin Login/ }).first();
  if (await adminLogin.count()) await adminLogin.click();
  await page.locator('input[type=email]').first().waitFor({ timeout: 20000 });
  await page.locator('input[type=email]').first().fill('admin@tiesora.test');
  await page.locator('input[type=password]').first().fill('Tiesora-Admin-2026!');
  await page.locator('button[type=submit]').first().click();
  await page.getByText('WELCOME BACK').first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Relationship Explorer');
    button?.click();
  });
  await page.waitForTimeout(1200);

  const selectPerson = async (index, person) => {
    await page.locator('button[aria-haspopup="listbox"]').nth(index).click();
    await page.waitForTimeout(250);
    const search = page.locator('input[aria-label^="Search Person"]').last();
    await search.fill(person.name);
    await page.waitForTimeout(400);
    const option = page.locator(`button[data-person-id="${person.id}"]`).first();
    if ((await option.count()) === 0) {
      throw new Error(`Could not find ${person.name} (${person.id}) in picker ${index}`);
    }
    await option.click();
    await page.waitForTimeout(650);
  };

  const manifest = [];
  for (const example of examples) {
    await selectPerson(0, { id: example.a, name: example.aName });
    await selectPerson(1, { id: example.b, name: example.bName });
    await page.waitForTimeout(900);

    const info = await page.evaluate(() => {
      const statuses = ['Verified Relationship', 'Incomplete Family Records', 'No Verified Relationship Found', 'Invalid Selection'];
      const heading = document.querySelector('h2')?.textContent?.trim() ?? null;
      const status = [...document.querySelectorAll('span')]
        .map((span) => span.textContent?.trim())
        .find((text) => text && statuses.includes(text)) ?? null;
      return { heading, status };
    });

    const explorer = page.locator('div.max-w-4xl').first();
    await explorer.screenshot({
      path: path.join(OUT_DIR, example.file),
      type: 'jpeg',
      quality: 86,
      animations: 'disabled',
    });

    manifest.push({
      file: example.file,
      expected: example.expected,
      actual: info.heading,
      status: info.status,
      personA: example.aName,
      personB: example.bName,
      matches: info.heading === example.expected,
    });
    console.log(`${example.file} | ${info.heading} | ${info.status}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    total: manifest.length,
    mismatches: manifest.filter((entry) => !entry.matches),
    errors: [...new Set(errors)].slice(-10),
  }, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
