/**
 * AI Extraction Engine
 * 
 * Transforms processed PDF content into structured family data using AI.
 * Handles person extraction, relationship inference, conflict detection,
 * and confidence scoring.
 * 
 * Key Features:
 * - Multi-generation family tree parsing
 * - Multiple spouse detection
 * - Adoption relationship identification
 * - Generation label preservation (A, B, C or I, II, III)
 * - Duplicate person detection
 * - Confidence scoring for all extractions
 * - Historical context preservation
 */

import type { 
  ProcessedPage 
} from './pdfProcessor';
import type { 
  ExtractedFamilyMember, 
  ExtractedRelationship,
  ImportConflict,
  Gender,
  LivingStatus
} from '../types';
import { supabase } from './supabase';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TYPES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RawExtractedPerson {
  full_name: string;
  display_name?: string;
  generation_label?: string; // 'A', 'B', 'C' or 'I', 'II', 'III'
  generation_level?: number;
  gender?: Gender;
  birth_year?: number;
  birth_date?: string;
  birth_place?: string;
  death_year?: number;
  death_date?: string;
  death_place?: string;
  living_status?: LivingStatus;
  child_number?: number; // Position among siblings
  branch?: string; // e.g., 'Kunigal', 'Maternal'
  biography?: string;
  source_pages: number[];
  confidence: number; // 0.0 to 1.0
}

interface RawExtractedRelationship {
  source_name: string;
  target_name: string;
  type: 'parent' | 'spouse' | 'child' | 'sibling' | 'adoptive_parent' | 'adopted_child';
  marriage_year?: number;
  marriage_date?: string;
  marriage_place?: string;
  divorce_date?: string;
  is_adoptive?: boolean;
  spouse_number?: number; // 1st wife, 2nd wife, etc.
  source_pages: number[];
  confidence: number;
  notes?: string;
}

interface ExtractionResult {
  people: RawExtractedPerson[];
  relationships: RawExtractedRelationship[];
  generation_structure: {
    label: string;
    level: number;
    count: number;
  }[];
  branches: string[];
  document_notes: string;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AI EXTRACTION PROMPT ENGINEERING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** The DB uses DATE; the AI may return a bare year. */
function normalizeDateForDb(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  return trimmed;
}

function buildExtractionPrompt(pages: ProcessedPage[], documentType: 'text' | 'diagram' | 'mixed'): string {
  const combinedText = pages
    .map(p => {
      const content = p.extractedText || p.ocrText || '';
      const diagramInfo = p.diagramAnalysis ? `\n[DIAGRAM ANALYSIS]\n${p.diagramAnalysis}` : '';
      return `=== PAGE ${p.pageNumber} ===\n${content}${diagramInfo}`;
    })
    .join('\n\n');

  console.log(`ðŸ¤– [Prompt] Building prompt for ${pages.length} pages, type: ${documentType}`);
  console.log(`ðŸ¤– [Prompt] Combined text length: ${combinedText.length} characters`);
  console.log(`ðŸ¤– [Prompt] First 300 chars of content:\n${combinedText.substring(0, 300)}`);

  return `You are an expert genealogist analyzing a family tree document. Your task is to extract ALL family members and their relationships with high accuracy.

DOCUMENT CONTENT:
${combinedText}

EXTRACTION RULES:

1. **People Extraction**:
   - Extract EVERY person mentioned with their full name
   - Preserve generation labels EXACTLY as written (e.g., "A", "B", "C" or "I", "II", "III", or "Gen 1", "Gen 2")
   - Extract birth/death years when visible (be conservative, mark as null if uncertain)
   - Infer gender ONLY when clearly indicated (names, relationships, pronouns)
   - Note child position if numbered (e.g., "eldest", "2nd child", "youngest")
   - Preserve branch labels (e.g., "Kunigal Branch", "Maternal Line")
   - Mark living status based on death date presence

2. **Relationship Extraction**:
   - Extract parent-child relationships explicitly stated
   - Identify spouse/marriage relationships
   - Note multiple marriages with spouse numbering (1st wife, 2nd wife)
   - Mark adoptive relationships distinctly
   - Infer sibling relationships from shared parents
   - Note relationship context (e.g., "married in 1950", "divorced")

3. **Special Cases**:
   - **Multiple Spouses**: List separately with spouse_number (1, 2, 3...)
   - **Adoptions**: Set is_adoptive = true and type = 'adoptive_parent' or 'adopted_child'
   - **Missing Information**: Use null, never guess
   - **Ambiguous Names**: Include variations in notes
   - **Contradictions**: Flag with lower confidence scores

4. **Confidence Scoring**:
   - 0.95-1.0: Explicitly stated, clear, no ambiguity
   - 0.80-0.94: Strong inference, consistent with context
   - 0.60-0.79: Reasonable inference, some uncertainty
   - 0.40-0.59: Weak inference, significant uncertainty
   - <0.40: Highly uncertain, needs manual review

5. **Page Tracking**:
   - Record ALL page numbers where each person/relationship appears
   - This helps admins verify information against source

RESPONSE FORMAT:

Return valid JSON with this EXACT structure (no markdown, no code blocks, just JSON):

{
  "people": [
    {
      "full_name": "string (REQUIRED)",
      "display_name": "string or null",
      "generation_label": "string or null (e.g., 'A', 'I', 'Gen 1')",
      "generation_level": number or null (1 for oldest generation),
      "gender": "male" | "female" | "unspecified" | null,
      "birth_year": number or null,
      "birth_date": "YYYY-MM-DD or null",
      "birth_place": "string or null",
      "death_year": number or null,
      "death_date": "YYYY-MM-DD or null",
      "death_place": "string or null",
      "living_status": "living" | "deceased" | "unknown",
      "child_number": number or null (position among siblings),
      "branch": "string or null (e.g., 'Kunigal')",
      "biography": "string or null (brief notes)",
      "source_pages": [array of page numbers],
      "confidence": 0.0 to 1.0
    }
  ],
  "relationships": [
    {
      "source_name": "string (parent or spouse A)",
      "target_name": "string (child or spouse B)",
      "type": "parent" | "spouse" | "child" | "sibling" | "adoptive_parent" | "adopted_child",
      "marriage_year": number or null,
      "marriage_date": "YYYY-MM-DD or null",
      "marriage_place": "string or null",
      "divorce_date": "YYYY-MM-DD or null",
      "is_adoptive": boolean,
      "spouse_number": number or null (1 for 1st wife, 2 for 2nd wife),
      "source_pages": [array of page numbers],
      "confidence": 0.0 to 1.0,
      "notes": "string or null"
    }
  ],
  "generation_structure": [
    {
      "label": "A",
      "level": 1,
      "count": 2
    }
  ],
  "branches": ["Kunigal", "Kempanhalli"],
  "document_notes": "Brief summary of document structure and any notable patterns"
}

CRITICAL: Return ONLY the JSON object. No additional text, no explanations, no markdown formatting.`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AI API INTEGRATION (Placeholder for Google Gemini)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callAIExtractionAPI(
  prompt: string,
  familyId: string,
): Promise<ExtractionResult> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('extract-family-pdf', {
    body: { familyId, prompt },
  });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // keep the original message
      }
    }
    throw new Error(message);
  }

  const text = typeof data?.text === 'string' ? data.text : '';
  if (!text.trim()) {
    throw new Error('AI proxy returned an empty response.');
  }

  return parseExtractionResponse(text);
}

/**
 * Parse AI response into ExtractionResult.
 */function parseExtractionResponse(text: string): ExtractionResult {
  console.log(`ðŸ¤– [Parser] Parsing AI response...`);
  console.log(`ðŸ¤– [Parser] Raw response length: ${text.length} characters`);
  console.log(`ðŸ¤– [Parser] First 300 chars:\n"${text.substring(0, 300)}"`);
  
  // Try to extract JSON from the response
  // AI sometimes wraps JSON in markdown code blocks
  let jsonText = text.trim();
  
  // Remove markdown code blocks if present
  const originalLength = jsonText.length;
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.substring(7);
    console.log(`ðŸ¤– [Parser] Removed \`\`\`json prefix`);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.substring(3);
    console.log(`ðŸ¤– [Parser] Removed \`\`\` prefix`);
  }
  
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.substring(0, jsonText.length - 3);
    console.log(`ðŸ¤– [Parser] Removed \`\`\` suffix`);
  }
  
  jsonText = jsonText.trim();
  
  if (jsonText.length !== originalLength) {
    console.log(`ðŸ¤– [Parser] Cleaned text length: ${jsonText.length} (was ${originalLength})`);
  }

  // Parse JSON response
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
    console.log(`âœ… [Parser] JSON parsed successfully`);
  } catch (parseError: any) {
    console.error(`âŒ [Parser] JSON parsing failed:`, parseError);
    console.error(`âŒ [Parser] Failed to parse text (first 1000 chars):\n${jsonText.substring(0, 1000)}`);
    console.error(`âŒ [Parser] Last 500 chars:\n${jsonText.substring(Math.max(0, jsonText.length - 500))}`);
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }
  
  console.log(`âœ… [Parser] Response keys:`, Object.keys(parsed));
  console.log(`âœ… [Parser] Has 'people' field:`, 'people' in parsed);
  console.log(`âœ… [Parser] Has 'relationships' field:`, 'relationships' in parsed);
  
  const extractionResult: ExtractionResult = {
    people: parsed.people || [],
    relationships: parsed.relationships || [],
    generation_structure: parsed.generation_structure || [],
    branches: parsed.branches || [],
    document_notes: parsed.document_notes || '',
  };
  
  if (!Array.isArray(extractionResult.people)) {
    console.error(`âŒ [Parser] 'people' field is not an array:`, typeof extractionResult.people);
    console.error(`âŒ [Parser] 'people' value:`, extractionResult.people);
    extractionResult.people = [];
  }
  
  if (!Array.isArray(extractionResult.relationships)) {
    console.error(`âŒ [Parser] 'relationships' field is not an array:`, typeof extractionResult.relationships);
    console.error(`âŒ [Parser] 'relationships' value:`, extractionResult.relationships);
    extractionResult.relationships = [];
  }

  console.log(`âœ… [Parser] Extracted: ${extractionResult.people.length} people, ${extractionResult.relationships.length} relationships`);
  
  if (extractionResult.people.length === 0) {
    console.warn(`âš ï¸ [Parser] WARNING: AI returned ZERO people!`);
    console.warn(`âš ï¸ [Parser] This could mean:`);
    console.warn(`âš ï¸ [Parser]   1. AI didn't understand the prompt`);
    console.warn(`âš ï¸ [Parser]   2. PDF text is empty or unreadable`);
    console.warn(`âš ï¸ [Parser]   3. AI response has wrong structure`);
    console.warn(`âš ï¸ [Parser] Full parsed response:`, JSON.stringify(parsed, null, 2).substring(0, 1000));
  } else {
    console.log(`âœ… [Parser] Sample people:`, extractionResult.people.slice(0, 3).map(p => p.full_name));
  }
  
  if (extractionResult.relationships.length > 0) {
    console.log(`âœ… [Parser] Sample relationships:`, extractionResult.relationships.slice(0, 3).map(r => `${r.source_name} -> ${r.target_name} (${r.type})`));
  }
  
  return extractionResult;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST-PROCESSING & VALIDATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Validate and normalize extracted person data
 */
function validatePerson(person: RawExtractedPerson): {
  valid: boolean;
  errors: string[];
  normalized: RawExtractedPerson;
} {
  const errors: string[] = [];
  const normalized = { ...person };

  // Required fields - ONLY full_name is truly required
  if (!person.full_name || person.full_name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
    return { valid: false, errors, normalized }; // Hard reject if no name
  }

  // Normalize name
  normalized.full_name = person.full_name.trim();
  normalized.display_name = person.display_name?.trim() || normalized.full_name;

  // Validate dates (but don't reject if invalid, just warn and fix)
  if (person.birth_year && (person.birth_year < 1000 || person.birth_year > new Date().getFullYear())) {
    console.warn(`âš ï¸ [Validation] ${person.full_name}: Invalid birth year ${person.birth_year}, setting to null`);
    normalized.birth_year = undefined;
  }

  if (person.death_year && (person.death_year < 1000 || person.death_year > new Date().getFullYear())) {
    console.warn(`âš ï¸ [Validation] ${person.full_name}: Invalid death year ${person.death_year}, setting to null`);
    normalized.death_year = undefined;
  }

  // Validate death after birth (reduce confidence but don't reject)
  if (person.birth_year && person.death_year && person.death_year < person.birth_year) {
    console.warn(`âš ï¸ [Validation] ${person.full_name}: Death year (${person.death_year}) before birth year (${person.birth_year}), reducing confidence`);
    normalized.confidence = Math.max(0, person.confidence - 0.2);
  }

  // Infer living status if not set
  if (!normalized.living_status) {
    normalized.living_status = person.death_year || person.death_date ? 'deceased' : 'unknown';
  }

  // Validate confidence score
  if (person.confidence < 0 || person.confidence > 1) {
    normalized.confidence = Math.max(0, Math.min(1, person.confidence));
  }

  // Ensure source pages exist
  if (!normalized.source_pages || normalized.source_pages.length === 0) {
    normalized.source_pages = [1]; // Default to page 1 if missing
  }

  // Person is valid as long as they have a name
  return {
    valid: true,
    errors,
    normalized,
  };
}

/**
 * Validate extracted relationship
 */
function validateRelationship(
  relationship: RawExtractedRelationship,
  people: RawExtractedPerson[]
): {
  valid: boolean;
  errors: string[];
  normalized: RawExtractedRelationship;
} {
  const errors: string[] = [];
  const normalized = { ...relationship };

  // Validate names exist
  if (!relationship.source_name || !relationship.target_name) {
    errors.push('Both source and target names are required');
    return { valid: false, errors, normalized }; // Hard reject if missing names
  }

  // Check if people exist (fuzzy match)
  const sourceExists = people.some(p => 
    p.full_name.toLowerCase().includes(relationship.source_name.toLowerCase()) ||
    relationship.source_name.toLowerCase().includes(p.full_name.toLowerCase())
  );
  const targetExists = people.some(p => 
    p.full_name.toLowerCase().includes(relationship.target_name.toLowerCase()) ||
    relationship.target_name.toLowerCase().includes(p.full_name.toLowerCase())
  );

  if (!sourceExists) {
    console.warn(`âš ï¸ [Validation] Relationship source person not found: ${relationship.source_name}`);
    errors.push(`Source person not found: ${relationship.source_name}`);
  }
  if (!targetExists) {
    console.warn(`âš ï¸ [Validation] Relationship target person not found: ${relationship.target_name}`);
    errors.push(`Target person not found: ${relationship.target_name}`);
  }

  // Reject if both people don't exist (can't create orphan relationships)
  if (!sourceExists || !targetExists) {
    return { valid: false, errors, normalized };
  }

  // Validate relationship type
  const validTypes = ['parent', 'spouse', 'child', 'sibling', 'adoptive_parent', 'adopted_child'];
  if (!validTypes.includes(relationship.type)) {
    console.warn(`âš ï¸ [Validation] Invalid relationship type: ${relationship.type}, defaulting to 'parent'`);
    normalized.type = 'parent';
  }

  // Normalize confidence
  if (relationship.confidence < 0 || relationship.confidence > 1) {
    normalized.confidence = Math.max(0, Math.min(1, relationship.confidence));
  }

  // Ensure source pages
  if (!normalized.source_pages || normalized.source_pages.length === 0) {
    normalized.source_pages = [1];
  }

  return {
    valid: true, // Valid if both people exist
    errors,
    normalized,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DUPLICATE DETECTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculate similarity between two names
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) return 1.0;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.85;

  // Levenshtein distance (simplified)
  const maxLength = Math.max(n1.length, n2.length);
  if (maxLength === 0) return 1.0;

  let distance = 0;
  for (let i = 0; i < Math.min(n1.length, n2.length); i++) {
    if (n1[i] !== n2[i]) distance++;
  }
  distance += Math.abs(n1.length - n2.length);

  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Detect duplicate persons within extracted data
 */
function detectInternalDuplicates(
  people: RawExtractedPerson[]
): Array<{
  person1: RawExtractedPerson;
  person2: RawExtractedPerson;
  similarity: number;
}> {
  const duplicates: Array<{
    person1: RawExtractedPerson;
    person2: RawExtractedPerson;
    similarity: number;
  }> = [];

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const similarity = calculateNameSimilarity(people[i].full_name, people[j].full_name);
      
      if (similarity > 0.75) {
        // High similarity - likely duplicate
        duplicates.push({
          person1: people[i],
          person2: people[j],
          similarity,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Detect duplicates against existing family members
 */
async function detectExistingDuplicates(
  extractedPeople: RawExtractedPerson[],
  familyId: string
): Promise<Array<{
  extractedPerson: RawExtractedPerson;
  existingPersonId: string;
  existingPersonName: string;
  similarity: number;
}>> {
  if (!supabase) return [];

  try {
    // Get existing family members
    const { data: existingPeople, error } = await supabase
      .from('family_people')
      .select('id, full_name, display_name')
      .eq('family_id', familyId);

    if (error || !existingPeople) return [];

    const duplicates: Array<{
      extractedPerson: RawExtractedPerson;
      existingPersonId: string;
      existingPersonName: string;
      similarity: number;
    }> = [];

    for (const extracted of extractedPeople) {
      for (const existing of existingPeople) {
        const similarity = calculateNameSimilarity(extracted.full_name, existing.full_name);
        
        if (similarity > 0.80) {
          duplicates.push({
            extractedPerson: extracted,
            existingPersonId: existing.id,
            existingPersonName: existing.full_name,
            similarity,
          });
        }
      }
    }

    return duplicates;

  } catch (error) {
    console.error('Error detecting existing duplicates:', error);
    return [];
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CONFLICT DETECTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detect conflicts in extracted data
 */
function detectConflicts(
  people: RawExtractedPerson[],
  relationships: RawExtractedRelationship[]
): Partial<ImportConflict>[] {
  const conflicts: Partial<ImportConflict>[] = [];

  // Detect contradictory dates
  people.forEach((person, idx) => {
    if (person.birth_year && person.death_year && person.death_year < person.birth_year) {
      conflicts.push({
        conflict_type: 'contradictory_dates',
        description: `${person.full_name} has death year (${person.death_year}) before birth year (${person.birth_year})`,
        evidence_pages: person.source_pages,
        extracted_member_ids: [], // Will be filled after DB insertion
      });
    }
  });

  // Detect circular relationships (person is their own ancestor)
  // This requires graph traversal - simplified check for direct cycles
  relationships.forEach(rel => {
    if (rel.source_name === rel.target_name) {
      conflicts.push({
        conflict_type: 'circular_relationship',
        description: `${rel.source_name} has a relationship with themselves`,
        evidence_pages: rel.source_pages,
      });
    }
  });

  // Detect multiple parent assignments without clear indication
  const childParentMap = new Map<string, string[]>();
  relationships
    .filter(r => r.type === 'parent')
    .forEach(r => {
      if (!childParentMap.has(r.target_name)) {
        childParentMap.set(r.target_name, []);
      }
      childParentMap.get(r.target_name)!.push(r.source_name);
    });

  childParentMap.forEach((parents, child) => {
    if (parents.length > 2) {
      conflicts.push({
        conflict_type: 'contradictory_parentage',
        description: `${child} has more than 2 parents listed: ${parents.join(', ')}`,
        evidence_pages: [],
      });
    }
  });

  return conflicts;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN EXTRACTION ORCHESTRATOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ExtractionProgress {
  stage: 'preparing' | 'extracting' | 'validating' | 'saving' | 'complete';
  message: string;
  progress: number; // 0-100
}

/**
 * Main extraction function - orchestrates the entire AI analysis process
 */
export async function extractFamilyDataFromPDF(
  pages: ProcessedPage[],
  jobId: string,
  familyId: string,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{
  success: boolean;
  extractedPeopleCount: number;
  extractedRelationshipsCount: number;
  conflictsCount: number;
  error?: string;
}> {
  try {
    const { supabase } = await import('./supabase');
    
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Stage 1: Prepare extraction
    if (onProgress) {
      onProgress({
        stage: 'preparing',
        message: 'Analyzing document structure...',
        progress: 5,
      });
    }

    // Determine document type
    const hasText = pages.some(p => p.extractedText && p.extractedText.length > 100);
    const documentType: 'text' | 'diagram' | 'mixed' = hasText ? 'text' : 'diagram';

    console.log(`ðŸ¤– [Extractor] Processing ${pages.length} pages, document type: ${documentType}`);
    
    // Log pages summary
    const pagesWithText = pages.filter(p => p.extractedText && p.extractedText.length > 100).length;
    const totalChars = pages.reduce((sum, p) => (p.extractedText?.length || 0) + sum, 0);
    console.log(`ðŸ¤– [Extractor] Pages with substantial text: ${pagesWithText}/${pages.length}`);
    console.log(`ðŸ¤– [Extractor] Total characters to analyze: ${totalChars}`);

    // Stage 2: Process in batches (5 pages at a time for manageable API calls)
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      batches.push(pages.slice(i, i + BATCH_SIZE));
    }

    console.log(`ðŸ¤– [Extractor] Split into ${batches.length} batches of ${BATCH_SIZE} pages each`);
    
    if (batches.length === 0) {
      console.error(`ðŸ¤– [Extractor] ERROR: No batches created! This should not happen.`);
      throw new Error('No pages to process');
    }

    let allPeople: RawExtractedPerson[] = [];
    let allRelationships: RawExtractedRelationship[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStart = batchIndex * BATCH_SIZE + 1;
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, pages.length);

      if (onProgress) {
        onProgress({
          stage: 'extracting',
          message: `Analyzing pages ${batchStart}-${batchEnd} of ${pages.length}...`,
          progress: 10 + (batchIndex / batches.length) * 50,
        });
      }

      console.log(`ðŸ¤– [Extractor] Processing batch ${batchIndex + 1}/${batches.length} (pages ${batchStart}-${batchEnd})`);
      
      // Log batch content summary
      const batchChars = batch.reduce((sum, p) => (p.extractedText?.length || 0) + sum, 0);
      console.log(`ðŸ¤– [Extractor] Batch ${batchIndex + 1} content: ${batchChars} characters`);

      try {
        const prompt = buildExtractionPrompt(batch, documentType);
        
        // Log prompt sample to verify content is being sent
        console.log(`ðŸ¤– [Extractor] Batch ${batchIndex + 1} prompt sample (first 500 chars):`);
        console.log(prompt.substring(0, 500) + '...');
        
        const batchResult = await callAIExtractionAPI(prompt, familyId);

        allPeople.push(...batchResult.people);
        allRelationships.push(...batchResult.relationships);

        console.log(`âœ… [Extractor] Batch ${batchIndex + 1} extracted: ${batchResult.people.length} people, ${batchResult.relationships.length} relationships`);
      } catch (batchError: any) {
        console.error(`âŒ [Extractor] Batch ${batchIndex + 1} failed:`, batchError);
        console.error(`âŒ [Extractor] Error details:`, batchError.message);
        console.error(`âŒ [Extractor] Error stack:`, batchError.stack);
        
        // If ALL batches fail, we need to know
        if (batchIndex === batches.length - 1 && allPeople.length === 0) {
          console.error(`âŒ [Extractor] CRITICAL: All batches failed or returned empty!`);
        }
        
        // Continue with other batches
      }
    }

    // Stage 3: Validation
    if (onProgress) {
      onProgress({
        stage: 'validating',
        message: 'Validating extracted data...',
        progress: 65,
      });
    }

    console.log(`ðŸ¤– [Extractor] Total extracted before validation: ${allPeople.length} people, ${allRelationships.length} relationships`);
    
    if (allPeople.length === 0 && allRelationships.length === 0) {
      console.error(`âŒ [Extractor] CRITICAL: AI extraction returned ZERO results!`);
      console.error(`âŒ [Extractor] This could mean:`);
      console.error(`âŒ [Extractor]   1. PDF contains no extractable text`);
      console.error(`âŒ [Extractor]   2. AI API failed to respond`);
      console.error(`âŒ [Extractor]   3. AI response JSON parsing failed`);
      console.error(`âŒ [Extractor]   4. Document format not recognized`);
    }

    const validatedPeople: RawExtractedPerson[] = [];
    const validationErrors: string[] = [];
    
    allPeople.forEach((person, idx) => {
      const validation = validatePerson(person);
      if (validation.valid) {
        validatedPeople.push(validation.normalized);
      } else {
        validationErrors.push(`Person "${person.full_name}": ${validation.errors.join(', ')}`);
      }
    });
    
    if (validationErrors.length > 0) {
      console.warn(`âš ï¸ [Extractor] Validation rejected ${validationErrors.length} people:`);
      validationErrors.slice(0, 5).forEach(err => console.warn(`âš ï¸ [Extractor]   - ${err}`));
    }

    const validatedRelationships: RawExtractedRelationship[] = [];
    const relValidationErrors: string[] = [];
    
    allRelationships.forEach(rel => {
      const validation = validateRelationship(rel, validatedPeople);
      if (validation.valid) {
        validatedRelationships.push(validation.normalized);
      } else {
        relValidationErrors.push(`Relationship ${rel.source_name} -> ${rel.target_name}: ${validation.errors.join(', ')}`);
      }
    });
    
    if (relValidationErrors.length > 0) {
      console.warn(`âš ï¸ [Extractor] Validation rejected ${relValidationErrors.length} relationships:`);
      relValidationErrors.slice(0, 5).forEach(err => console.warn(`âš ï¸ [Extractor]   - ${err}`));
    }

    console.log(`âœ… [Extractor] After validation: ${validatedPeople.length} people, ${validatedRelationships.length} relationships`);
    
    if (validatedPeople.length === 0) {
      console.error(`âŒ [Extractor] CRITICAL: ALL PEOPLE REJECTED DURING VALIDATION!`);
      console.error(`âŒ [Extractor] Original count: ${allPeople.length}, Validated: ${validatedPeople.length}`);
      console.error(`âŒ [Extractor] Check validation rules - they may be too restrictive`);
    }

    // Stage 4: Save to database
    if (onProgress) {
      onProgress({
        stage: 'saving',
        message: 'Saving extracted data to database...',
        progress: 75,
      });
    }

    // Save extracted people
    const peopleToInsert = validatedPeople.map(person => ({
      import_job_id: jobId,
      family_id: familyId,
      full_name: person.full_name,
      gender: person.gender || null,
      birth_date: normalizeDateForDb(person.birth_date),
      death_date: normalizeDateForDb(person.death_date),
      living_status: person.living_status || 'unknown',
      biography: person.biography || null,
      generation_label: person.generation_label || null,
      branch: person.branch || null,
      source_page_numbers: person.source_pages || [],
      confidence_score: person.confidence || 0.7,
      verification_status: 'needs_review' as const,
    }));

    console.log(`ðŸ’¾ [Extractor] Inserting ${peopleToInsert.length} people...`);
    
    if (peopleToInsert.length === 0) {
      console.error(`âŒ [Extractor] ERROR: No people to insert! Extraction failed.`);
      console.error(`âŒ [Extractor] Diagnostic summary:`);
      console.error(`âŒ [Extractor]   - Total pages processed: ${pages.length}`);
      console.error(`âŒ [Extractor]   - Batches attempted: ${batches.length}`);
      console.error(`âŒ [Extractor]   - Raw people from AI: ${allPeople.length}`);
      console.error(`âŒ [Extractor]   - People after validation: ${validatedPeople.length}`);
      console.error(`âŒ [Extractor]   - People to insert: ${peopleToInsert.length}`);
      
      if (allPeople.length === 0) {
        throw new Error('AI extraction returned zero people. Check: 1) PDF contains extractable text, 2) Groq API key is valid, 3) AI response parsing succeeded. See console logs for details.');
      } else if (validatedPeople.length === 0) {
        throw new Error(`Validation rejected all ${allPeople.length} people extracted by AI. Check validation warnings in console above`);
      } else {
        throw new Error('Failed to prepare people for database insertion after validation');
      }
    }

    const { data: insertedPeople, error: peopleError } = await supabase
      .from('extracted_family_members')
      .insert(peopleToInsert)
      .select();

    if (peopleError) {
      console.error('Error inserting people:', peopleError);
      throw new Error(`Failed to save extracted people: ${peopleError.message}`);
    }

    console.log(`âœ… [Extractor] Inserted ${insertedPeople?.length || 0} people successfully`);
    
    if (!insertedPeople || insertedPeople.length === 0) {
      console.error(`âŒ [Extractor] ERROR: Database insert returned ZERO people!`);
      console.error(`âŒ [Extractor] Check Supabase RLS policies and table permissions`);
    }

    // Create mapping of names to IDs
    const nameToIdMap = new Map<string, string>();
    if (insertedPeople) {
      insertedPeople.forEach(person => {
        nameToIdMap.set(person.full_name, person.id);
      });
    }

    // Save extracted relationships
    const relationshipsToInsert = validatedRelationships
      .map(rel => {
        const sourceId = nameToIdMap.get(rel.source_name);
        const targetId = nameToIdMap.get(rel.target_name);

        if (!sourceId || !targetId) {
          console.warn(`Skipping relationship: ${rel.source_name} -> ${rel.target_name} (person not found)`);
          return null;
        }

        return {
          import_job_id: jobId,
          family_id: familyId,
          source_extracted_id: sourceId,
          target_extracted_id: targetId,
          relationship_type: rel.type,
          confidence_score: rel.confidence || 0.7,
          verification_status: 'needs_review' as const,
          source_page_numbers: rel.source_pages || [],
        };
      })
      .filter(rel => rel !== null);

    console.log(`ðŸ’¾ [Extractor] Inserting ${relationshipsToInsert.length} relationships...`);

    if (relationshipsToInsert.length === 0) {
      console.warn(`âš ï¸ [Extractor] WARNING: No relationships to insert`);
    }
    
    const { data: insertedRelationships, error: relationshipsError } = await supabase
      .from('extracted_relationships')
      .insert(relationshipsToInsert)
      .select();

    if (relationshipsError) {
      console.error('Error inserting relationships:', relationshipsError);
      throw new Error(`Failed to save relationships: ${relationshipsError.message}`);
    }

    console.log(`âœ… [Extractor] Inserted ${insertedRelationships?.length || 0} relationships successfully`);

    // Update job status
    console.log(`ðŸ’¾ [Extractor] Updating job status to 'processed'...`);
    await supabase
      .from('family_import_jobs')
      .update({
        status: 'processed',
        processing_completed_at: new Date().toISOString(),
        extracted_person_count: insertedPeople?.length || 0,
        extracted_relationship_count: insertedRelationships?.length || 0,
      })
      .eq('id', jobId);

    if (onProgress) {
      onProgress({
        stage: 'complete',
        message: 'Extraction complete!',
        progress: 100,
      });
    }

    console.log(`âœ… [Extractor] ========== EXTRACTION COMPLETE ==========`);
    console.log(`âœ… [Extractor] Extracted People: ${insertedPeople?.length || 0}`);
    console.log(`âœ… [Extractor] Extracted Relationships: ${insertedRelationships?.length || 0}`);
    console.log(`âœ… [Extractor] Job Status: processed`);
    console.log(`âœ… [Extractor] =============================================`);

    return {
      success: true,
      extractedPeopleCount: insertedPeople?.length || 0,
      extractedRelationshipsCount: insertedRelationships?.length || 0,
      conflictsCount: 0,
    };

  } catch (error: any) {
    console.error('Extraction failed:', error);
    
    // Try to update job status to failed
    try {
      const { supabase } = await import('./supabase');
      if (supabase) {
        await supabase
          .from('family_import_jobs')
          .update({
            status: 'failed',
            processing_error: error.message,
          })
          .eq('id', jobId);
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return {
      success: false,
      extractedPeopleCount: 0,
      extractedRelationshipsCount: 0,
      conflictsCount: 0,
      error: error.message,
    };
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UTILITY: Generation Level Assignment
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Assign numeric generation levels based on relationships
 * Useful when document uses labels like 'A', 'B', 'C' but we need hierarchy
 */
export function assignGenerationLevels(
  people: RawExtractedPerson[],
  relationships: RawExtractedRelationship[]
): Map<string, number> {
  const levels = new Map<string, number>();
  
  // Find root ancestors (people with no parents)
  const childrenNames = new Set(
    relationships
      .filter(r => r.type === 'parent')
      .map(r => r.target_name)
  );

  const roots = people.filter(p => !childrenNames.has(p.full_name));
  
  // Assign level 1 to roots
  roots.forEach(root => levels.set(root.full_name, 1));

  // BFS to assign levels to descendants
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current.full_name) || 1;

    // Find children
    const children = relationships
      .filter(r => r.type === 'parent' && r.source_name === current.full_name)
      .map(r => r.target_name);

    children.forEach(childName => {
      if (!levels.has(childName)) {
        levels.set(childName, currentLevel + 1);
        const childPerson = people.find(p => p.full_name === childName);
        if (childPerson) queue.push(childPerson);
      }
    });
  }

  return levels;
}
