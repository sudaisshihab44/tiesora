# Relationship Engine — Working Examples

All 39 screenshots were captured from the production app at
`https://tiesora-alpha.vercel.app` using the real family records. Every
screenshot matched its expected label; the browser reported zero console
errors.

**Open [index.html](index.html) for the visual gallery.**

**Download [Tiesora-Relationship-Examples.html](Tiesora-Relationship-Examples.html)** for a single self-contained file with all 39 screenshots embedded.

## Coverage

| Result | Person A | Person B | Status | Screenshot |
|---|---|---|---|---|
| Father | Ayesha Bi | Mohd. Hashim | Verified Relationship | [01-father.jpg](01-father.jpg) |
| Mother | Jaleel | Tahseen | Verified Relationship | [02-mother.jpg](02-mother.jpg) |
| Son | Darvesh Mohammed | Abdul Latheef | Verified Relationship | [03-son.jpg](03-son.jpg) |
| Daughter | Abdul Hameed | Qhadija Bi | Verified Relationship | [04-daughter.jpg](04-daughter.jpg) |
| Grandfather | Sabiha (d/o Nawab) | Fazlulla Sharif | Verified Relationship | [05-grandfather.jpg](05-grandfather.jpg) |
| Grandmother | Badar | Zakera Khatoon | Verified Relationship | [06-grandmother.jpg](06-grandmother.jpg) |
| Grandson | Darvesh Mohammed | Lala Mian | Verified Relationship | [07-grandson.jpg](07-grandson.jpg) |
| Granddaughter | Darvesh Mohammed | Qhadija Bi | Verified Relationship | [08-granddaughter.jpg](08-granddaughter.jpg) |
| Great-Grandson | Darvesh Mohammed | Abdul Qhader Shariff | Verified Relationship | [09-great-grandson.jpg](09-great-grandson.jpg) |
| Great-Granddaughter | Darvesh Mohammed | Qhader Bi | Verified Relationship | [10-great-granddaughter.jpg](10-great-granddaughter.jpg) |
| Brother | Hajira Masroor | Sadiq Hussain | Verified Relationship | [11-brother.jpg](11-brother.jpg) |
| Sister | Naseebunnisa | Azeeza Arif | Verified Relationship | [12-sister.jpg](12-sister.jpg) |
| Nephew | Abdul Latheef | Syed Yousuf | Verified Relationship | [13-nephew.jpg](13-nephew.jpg) |
| Niece | Abdul Latheef | Qhadija Bi | Verified Relationship | [14-niece.jpg](14-niece.jpg) |
| First Cousin | Lala Mian | Syed Yousuf | Verified Relationship | [15-first-cousin.jpg](15-first-cousin.jpg) |
| Second Cousin | Abdul Qhader Shariff | Azmathullah Khan Miyan | Verified Relationship | [16-second-cousin.jpg](16-second-cousin.jpg) |
| First Cousin Once Removed | Lala Mian | Azmathullah Khan Miyan | Verified Relationship | [17-first-cousin-once-removed.jpg](17-first-cousin-once-removed.jpg) |
| Husband | Qhader Bi | Ghulam Mohiuddin Khan | Verified Relationship | [18-husband.jpg](18-husband.jpg) |
| Wife | Abdul Wahab Khan | Rabia Bi | Verified Relationship | [19-wife.jpg](19-wife.jpg) |
| Father-in-Law | Qhader Bi | Ghulam Masood Khan | Verified Relationship | [20-father-in-law.jpg](20-father-in-law.jpg) |
| Mother-in-Law | Zamira Khanum | Tahseen | Incomplete Family Records | [21-mother-in-law.jpg](21-mother-in-law.jpg) |
| Son-in-Law | Lala Mian | Ghulam Mohiuddin Khan | Verified Relationship | [22-son-in-law.jpg](22-son-in-law.jpg) |
| Daughter-in-Law | Saleha Khanum | Nahida Tabassumf | Verified Relationship | [23-daughter-in-law.jpg](23-daughter-in-law.jpg) |
| Brother-in-Law | Abdul Qhader Shariff | Ghulam Mohiuddin Khan | Verified Relationship | [24-brother-in-law.jpg](24-brother-in-law.jpg) |
| Sister-in-Law | Hajira Masroor | Nahida Tabassumf | Verified Relationship | [25-sister-in-law.jpg](25-sister-in-law.jpg) |
| Step-Mother | Ayesha Bi | Majoo Bi Bi | Verified Relationship | [26-step-mother.jpg](26-step-mother.jpg) |
| Step-Father | Raziya | Majid Hussain | Verified Relationship | [27-step-father.jpg](27-step-father.jpg) |
| Step-Son | Zahara Khatoon | Saad Mohd. Shariff | Verified Relationship | [28-step-son.jpg](28-step-son.jpg) |
| Step-Daughter | Rabia Bi (d/o Abdul Qhader) | Amtul Aleem | Verified Relationship | [29-step-daughter.jpg](29-step-daughter.jpg) |
| Step-Brother | Sana Farheen | Saad Mohd. Shariff | Verified Relationship | [30-step-brother.jpg](30-step-brother.jpg) |
| Step-Sister | Sana Farheen | Sara Almas | Verified Relationship | [31-step-sister.jpg](31-step-sister.jpg) |
| Adoptive Father | Ghulam Mohiuddin Khan | Ghulam Masood Khan | Verified Relationship | [32-adoptive-father.jpg](32-adoptive-father.jpg) |
| Aunt/Uncle | Sabiha (d/o Nawab) | Mehrun | Verified Relationship | [33-aunt-uncle.jpg](33-aunt-uncle.jpg) |
| Grandnephew | Abdul Latheef | Azmathullah Khan Miyan | Verified Relationship | [34-grandnephew.jpg](34-grandnephew.jpg) |
| Aunt-in-Law | Sana Farheen | Naheeda Khatoon | Verified Relationship | [35-aunt-in-law.jpg](35-aunt-in-law.jpg) |
| Niece-in-Law | Ghulam Mohiuddin Khan | Rabia Bi (d/o Abdul Qhader) | Verified Relationship | [36-niece-in-law.jpg](36-niece-in-law.jpg) |
| Extended Family Connection | Darvesh Mohammed | Ghulam Mohiuddin Khan | Incomplete Family Records | [37-extended.jpg](37-extended.jpg) |
| No Verified Relationship Found | Abdul Latheef | Maher | Incomplete Family Records | [38-incomplete.jpg](38-incomplete.jpg) |
| Brother | Abdul Latheef | Abdul Hameed | Incomplete Family Records | [39-ambiguous-sibling.jpg](39-ambiguous-sibling.jpg) |

## Not available from the current recorded data

- **Paternal/Maternal Aunt or Uncle:** the connecting aunt/uncle records have
  unspecified gender, so the engine uses the generic Aunt/Uncle label. The
  gender-specific labels are covered by automated tests.
- **Verified half-sibling:** the other parent is missing for the available
  sibling pairs; the gallery shows the honest incomplete-record case.
- **Great-Aunt/Great-Uncle:** no such pair exists in the connected production
  graph.
- **Invalid Selection:** the UI only loads one family, so two families cannot be
  selected there. The engine rejects this in the automated suite.

## Verification

- Production app commit: `9b7df44`
- Screenshots: 39
- Verified: 35
- Incomplete: 4
- Label mismatches: 0
- Console errors: 0
