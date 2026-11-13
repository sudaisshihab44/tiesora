import { FamilyPerson, Relationship, Memory, FamilyEvent, Family } from '../types';
import { calculateRelationship } from './relationshipEngine';

export interface AssistantAnswer {
  text: string;
  citedPeople: FamilyPerson[];
  suggestedAction?: {
    type: 'explore_relationship' | 'view_person' | 'open_tree';
    personId?: string;
    personBId?: string;
  };
}

export function answerFamilyQuestion(
  query: string,
  people: FamilyPerson[],
  relationships: Relationship[],
  memories: Memory[],
  events: FamilyEvent[],
  family: Family
): AssistantAnswer {
  const q = query.toLowerCase();
  const peopleMap = new Map<string, FamilyPerson>(people.map(p => [p.id, p]));

  // 1. Relationship query between two people
  // e.g. "how is X related to Y", "how am I related to X"
  const mentionedPeople = people.filter(p =>
    q.includes(p.display_name.toLowerCase()) || q.includes(p.full_name.toLowerCase())
  );

  if (mentionedPeople.length >= 2) {
    const pA = mentionedPeople[0];
    const pB = mentionedPeople[1];
    const rel = calculateRelationship(pA, pB, people, relationships);

    let text = `According to verified family records, **${pA.display_name}** and **${pB.display_name}** are **${rel.primaryLabel}**.\n\n` +
      `**Lineage Path:** ${rel.pathDescription}\n\n`;

    if (rel.sharedAncestors.length > 0) {
      text += `**Shared Common Ancestor(s):** ${rel.sharedAncestors.map(a => `${a.display_name} (Gen ${a.generation_level})`).join(', ')}.\n\n`;
    }

    text += `**Connection Chain:** ${rel.pathNodes.map(n => n.display_name).join(' ➔ ')}`;

    return {
      text,
      citedPeople: [pA, pB, ...rel.sharedAncestors],
      suggestedAction: {
        type: 'explore_relationship',
        personId: pA.id,
        personBId: pB.id,
      },
    };
  }

  // 2. Summary or biography of a specific person
  if (mentionedPeople.length === 1) {
    const person = mentionedPeople[0];
    const personMemories = memories.filter(m => m.tagged_person_ids.includes(person.id));
    const personEvents = events.filter(e => e.associated_person_ids.includes(person.id));

    // Find parents
    const parents = relationships
      .filter(r => r.target_person_id === person.id && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type))
      .map(r => peopleMap.get(r.source_person_id)?.display_name)
      .filter(Boolean);

    // Find spouses
    const spouses = relationships
      .filter(r => ['spouse', 'partner'].includes(r.relationship_type) && (r.source_person_id === person.id || r.target_person_id === person.id))
      .map(r => (r.source_person_id === person.id ? peopleMap.get(r.target_person_id)?.display_name : peopleMap.get(r.source_person_id)?.display_name))
      .filter(Boolean);

    // Find children
    const children = relationships
      .filter(r => r.source_person_id === person.id && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type))
      .map(r => peopleMap.get(r.target_person_id)?.display_name)
      .filter(Boolean);

    let text = `**Recorded Profile for ${person.full_name} (${person.display_name}):**\n\n` +
      `• **Generation:** Generation ${person.generation_level} (${person.branch || 'Direct lineage'})\n` +
      `• **Status:** ${person.living_status === 'living' ? 'Living' : 'Deceased'}\n` +
      `• **Lifespan:** ${person.birth_date || 'Date unknown'} ${person.birth_place ? `in ${person.birth_place}` : ''}` +
      `${person.death_date ? ` – ${person.death_date}` : ''}\n\n`;

    if (parents.length > 0) text += `• **Parents:** ${parents.join(', ')}\n`;
    if (spouses.length > 0) text += `• **Spouse / Partner:** ${spouses.join(', ')}\n`;
    if (children.length > 0) text += `• **Children:** ${children.join(', ')}\n`;

    if (person.biography) {
      text += `\n**Biography & Notes:**\n"${person.biography}"\n`;
    }

    if (personMemories.length > 0) {
      text += `\n**Archival Memories:** Tagged in ${personMemories.length} record(s): ${personMemories.map(m => `"${m.title}"`).join(', ')}.`;
    }

    return {
      text,
      citedPeople: [person],
      suggestedAction: {
        type: 'view_person',
        personId: person.id,
      },
    };
  }

  // 3. Generation queries
  if (q.includes('generation 1') || q.includes('great-grandparent') || q.includes('gen 1')) {
    const gen1 = people.filter(p => p.generation_level === 1);
    const text = `**Generation I (Great-Grandparents)** currently includes ${gen1.length} recorded members in the ${family.name}:\n\n` +
      gen1.map(p => `• **${p.display_name}** (${p.birth_date ? p.birth_date.substring(0, 4) : 'Undated'} – ${p.death_date ? p.death_date.substring(0, 4) : p.living_status}): ${p.birth_place || 'Birthplace unrecorded'}`).join('\n');
    return {
      text,
      citedPeople: gen1,
      suggestedAction: { type: 'open_tree' },
    };
  }

  if (q.includes('generation 4') || q.includes('children') || q.includes('youngest')) {
    const gen4 = people.filter(p => p.generation_level === 4);
    const text = `**Generation IV (Children)** currently includes ${gen4.length} members:\n\n` +
      gen4.map(p => `• **${p.display_name}** (Born ${p.birth_date ? p.birth_date.substring(0, 4) : 'Undated'})`).join('\n');
    return {
      text,
      citedPeople: gen4,
      suggestedAction: { type: 'open_tree' },
    };
  }

  // 4. Default overview response
  const exampleA = people[0]?.display_name || 'a relative';
  const exampleB = people[1]?.display_name || 'another relative';
  const examplePlace =
    memories.find((memory) => memory.location)?.location || 'a place';

  return {
    text: `I’m your Tiesora Family Assistant. I can answer inquiries grounded strictly in your **${family.name}** records (${people.length} people, ${relationships.length} relationships, ${memories.length} memories).\n\n` +
      `Try asking:\n` +
      `• *"How is ${exampleA} related to ${exampleB}?"*\n` +
      `• *"Summarize ${exampleA}'s recorded history"*\n` +
      `• *"Who belongs to Generation I?"*\n` +
      `• *"Show memories from ${examplePlace}"*`,
    citedPeople: [],
  };
}
