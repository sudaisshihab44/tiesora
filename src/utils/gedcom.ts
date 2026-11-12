import { FamilyPerson, Relationship, Family } from '../types';

export function exportToGEDCOM(
  people: FamilyPerson[],
  relationships: Relationship[],
  family: Family
): string {
  const lines: string[] = [];

  // 1. Header
  lines.push('0 HEAD');
  lines.push('1 SOUR TIESORA');
  lines.push('2 VERS 1.0.0');
  lines.push('2 NAME Tiesora Family Tree');
  lines.push(`1 DATE ${new Date().toISOString().substring(0, 10).replace(/-/g, ' ')}`);
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // Build families lookup
  // For each marriage or parent-child grouping
  const spousePairs = new Map<string, { husbId?: string; wifeId?: string; children: string[] }>();

  // Map people
  people.forEach(p => {
    lines.push(`0 @${p.id}@ INDI`);
    lines.push(`1 NAME ${p.display_name} /${p.full_name.split(' ').slice(-1)[0]}/`);
    lines.push(`2 GIVN ${p.display_name}`);
    lines.push(`2 SURN ${p.full_name.split(' ').slice(-1)[0]}`);
    if (p.gender === 'male') lines.push('1 SEX M');
    else if (p.gender === 'female') lines.push('1 SEX F');
    else lines.push('1 SEX U');

    if (p.birth_date || p.birth_place) {
      lines.push('1 BIRT');
      if (p.birth_date) lines.push(`2 DATE ${p.birth_date}`);
      if (p.birth_place) lines.push(`2 PLAC ${p.birth_place}`);
    }

    if (p.living_status === 'deceased' || p.death_date) {
      lines.push('1 DEAT');
      if (p.death_date) lines.push(`2 DATE ${p.death_date}`);
      if (p.death_place) lines.push(`2 PLAC ${p.death_place}`);
    }

    if (p.biography) {
      lines.push(`1 NOTE ${p.biography}`);
    }
  });

  // Track parent-child connections
  relationships.forEach(rel => {
    if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationship_type)) {
      const famKey = `FAM_${rel.source_person_id}`;
      const entry = spousePairs.get(famKey) || { children: [] };
      if (!entry.husbId) entry.husbId = rel.source_person_id;
      if (!entry.children.includes(rel.target_person_id)) {
        entry.children.push(rel.target_person_id);
      }
      spousePairs.set(famKey, entry);
    }
  });

  // Output FAM records
  let famIdx = 1;
  spousePairs.forEach((famData) => {
    lines.push(`0 @FAM_${famIdx}@ FAM`);
    if (famData.husbId) lines.push(`1 HUSB @${famData.husbId}@`);
    if (famData.wifeId) lines.push(`1 WIFE @${famData.wifeId}@`);
    famData.children.forEach(cId => {
      lines.push(`1 CHIL @${cId}@`);
    });
    famIdx++;
  });

  // Trailer
  lines.push('0 TRLR');

  return lines.join('\n');
}

export function parseGEDCOMSummary(gedcomText: string): { individualCount: number; familyCount: number } {
  const lines = gedcomText.split('\n');
  let indi = 0;
  let fam = 0;
  lines.forEach(line => {
    if (line.includes(' INDI')) indi++;
    if (line.includes(' FAM')) fam++;
  });
  return { individualCount: indi, familyCount: fam };
}
