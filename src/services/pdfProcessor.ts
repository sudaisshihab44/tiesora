/**
 * PDF Processing Service
 * 
 * Handles PDF text extraction, OCR for scanned documents, and image analysis.
 * This service acts as the bridge between uploaded PDFs and AI extraction.
 * 
 * Technologies:
 * - PDF.js for text extraction
 * - Google Gemini Vision API for OCR and diagram analysis
 * - Page-by-page processing with progress tracking
 */

import type { ExtractionMethod } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PDFPageContent {
  pageNumber: number;
  extractedText: string;
  hasText: boolean;
  isScanned: boolean;
  imageDataUrl?: string; // Base64 encoded image for vision analysis
  width: number;
  height: number;
}

export interface PDFProcessingResult {
  totalPages: number;
  pages: PDFPageContent[];
  processingTimeMs: number;
  errors: string[];
}

export interface ProcessingProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF TEXT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract text content from a PDF file using PDF.js
 * 
 * @param file - The PDF file to process
 * @param onProgress - Optional callback for progress updates
 * @returns Extracted content for each page
 */
export async function extractPDFContent(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<PDFProcessingResult> {
  const startTime = Date.now();
  const pages: PDFPageContent[] = [];
  const errors: string[] = [];

  try {
    // Dynamically import PDF.js
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Load PDF document
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    console.log(`📄 [PDF] PDF loaded: ${totalPages} pages`);
    console.log(`📄 [PDF] File size: ${(file.size / 1024).toFixed(2)} KB`);

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        if (onProgress) {
          onProgress({
            currentPage: pageNum,
            totalPages,
            status: `Extracting text from page ${pageNum} of ${totalPages}...`,
          });
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Extract text content
        const textContent = await page.getTextContent();
        const textItems = textContent.items as any[];
        const extractedText = textItems
          .map((item) => item.str)
          .join(' ')
          .trim();

        const hasText = extractedText.length > 50; // Consider page has text if > 50 chars
        
        // For scanned pages or pages with diagrams, we'll need the image
        let imageDataUrl: string | undefined;
        if (!hasText || pageNum <= 10) { // Always capture first 10 pages as images for diagram analysis
          try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (context) {
              const scale = 2; // Higher resolution for better OCR
              const scaledViewport = page.getViewport({ scale });
              
              canvas.height = scaledViewport.height;
              canvas.width = scaledViewport.width;
              
              const renderContext = {
                canvasContext: context,
                viewport: scaledViewport,
              };
              
              await page.render(renderContext).promise;
              imageDataUrl = canvas.toDataURL('image/png');
            }
          } catch (imgError) {
            console.warn(`Failed to render page ${pageNum} as image:`, imgError);
          }
        }

        const pageContent: PDFPageContent = {
          pageNumber: pageNum,
          extractedText,
          hasText,
          isScanned: !hasText,
          imageDataUrl,
          width: viewport.width,
          height: viewport.height,
        };

        pages.push(pageContent);
        
        console.log(`📄 [PDF] Page ${pageNum}: ${extractedText.length} chars, hasText: ${hasText}`);
        if (extractedText.length > 0) {
          console.log(`📄 [PDF] Page ${pageNum} preview: "${extractedText.substring(0, 150)}..."`);
        }

      } catch (pageError: any) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        errors.push(`Page ${pageNum}: ${pageError.message}`);
        
        // Add empty page to maintain page numbers
        pages.push({
          pageNumber: pageNum,
          extractedText: '',
          hasText: false,
          isScanned: true,
          imageDataUrl: undefined,
          width: 0,
          height: 0,
        });
      }
    }

    console.log(`📄 [PDF] PDF processing complete: ${pages.length} pages processed in ${Date.now() - startTime}ms`);
    
    // Calculate statistics
    const pagesWithText = pages.filter(p => p.hasText).length;
    const pagesScanned = pages.filter(p => p.isScanned).length;
    const totalChars = pages.reduce((sum, p) => sum + p.extractedText.length, 0);
    
    console.log(`📄 [PDF] Statistics:`);
    console.log(`📄 [PDF]   - Pages with text: ${pagesWithText}/${pages.length}`);
    console.log(`📄 [PDF]   - Scanned pages: ${pagesScanned}/${pages.length}`);
    console.log(`📄 [PDF]   - Total characters extracted: ${totalChars}`);
    console.log(`📄 [PDF]   - Average chars per page: ${(totalChars / pages.length).toFixed(0)}`);

    return {
      totalPages,
      pages,
      processingTimeMs: Date.now() - startTime,
      errors,
    };

  } catch (error: any) {
    console.error('PDF extraction error:', error);
    errors.push(error.message || 'Failed to extract PDF content');
    
    return {
      totalPages: 0,
      pages,
      processingTimeMs: Date.now() - startTime,
      errors,
    };
  }
}

/**
 * Determine the best extraction method for a page
 * 
 * @param page - The page content to analyze
 * @returns The recommended extraction method
 */
export function determineExtractionMethod(page: PDFPageContent): ExtractionMethod {
  // Has substantial text content → use text extraction
  if (page.hasText && page.extractedText.trim().length > 100) {
    return 'text';
  }

  // No text but has image → likely scanned or contains diagrams
  if (!page.hasText && page.imageDataUrl) {
    return 'vision';
  }

  // Has some text and image → hybrid approach may be needed
  if (page.hasText && page.imageDataUrl) {
    return 'hybrid';
  }

  // Default to vision for scanned documents
  return page.isScanned ? 'ocr' : 'text';
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GEMINI VISION API INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

export interface VisionOCRResult {
  text: string;
  confidence: number;
  language: string;
}

/**
 * Perform OCR on a page image using Google Gemini Vision API
 * 
 * @param imageDataUrl - Base64 encoded image
 * @param pageNumber - Page number for context
 * @returns Extracted text and confidence
 */
export async function performVisionOCR(
  imageDataUrl: string,
  pageNumber: number
): Promise<VisionOCRResult> {
  try {
    // Import Google GenAI - using dynamic import for better code splitting
    const genAI = await import('@google/genai');
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    // Note: Actual API initialization will depend on @google/genai package structure
    // This is a placeholder - refer to package documentation for exact usage
    
    // Placeholder for Gemini API call
    // In production, use the actual API according to @google/genai docs
    const text = `[OCR placeholder for page ${pageNumber}]`;

    return {
      text: text.trim(),
      confidence: 0.85,
      language: 'en',
    };

  } catch (error: any) {
    console.error('Vision OCR error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Analyze a family tree diagram using vision AI
 * 
 * @param imageDataUrl - Base64 encoded image of the diagram
 * @param pageNumber - Page number for context
 * @returns Structured analysis of the diagram
 */
export async function analyzeFamilyTreeDiagram(
  imageDataUrl: string,
  pageNumber: number
): Promise<string> {
  try {
    // Import Google GenAI
    const genAI = await import('@google/genai');
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    // Placeholder for actual Gemini Vision API call
    // In production, implement according to @google/genai package documentation
    
    const analysis = `[Diagram analysis placeholder for page ${pageNumber}]`;
    
    return analysis;

  } catch (error: any) {
    console.error('Diagram analysis error:', error);
    throw new Error(`Diagram analysis failed: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PROCESSING ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessedPage {
  pageNumber: number;
  extractedText: string;
  ocrText?: string;
  diagramAnalysis?: string;
  extractionMethod: ExtractionMethod;
  processingTimeMs: number;
  error?: string;
}

/**
 * Process a single PDF page with the appropriate extraction method
 * 
 * @param page - The page content from PDF extraction
 * @param options - Processing options
 * @returns Processed page with extracted content
 */
export async function processPage(
  page: PDFPageContent,
  options: {
    useVisionForScanned?: boolean;
    analyzeDiagrams?: boolean;
  } = {}
): Promise<ProcessedPage> {
  const startTime = Date.now();
  const method = determineExtractionMethod(page);

  const processed: ProcessedPage = {
    pageNumber: page.pageNumber,
    extractedText: page.extractedText,
    extractionMethod: method,
    processingTimeMs: 0,
  };

  try {
    switch (method) {
      case 'text':
        // Already have text from PDF extraction
        processed.extractedText = page.extractedText;
        break;

      case 'ocr':
      case 'vision':
        // Use vision API for scanned pages or when text is minimal
        if (page.imageDataUrl && options.useVisionForScanned !== false) {
          const ocrResult = await performVisionOCR(page.imageDataUrl, page.pageNumber);
          processed.ocrText = ocrResult.text;
          processed.extractedText = ocrResult.text;
        }
        break;

      case 'hybrid':
        // Combine text extraction with diagram analysis
        processed.extractedText = page.extractedText;
        
        if (page.imageDataUrl && options.analyzeDiagrams !== false) {
          processed.diagramAnalysis = await analyzeFamilyTreeDiagram(
            page.imageDataUrl,
            page.pageNumber
          );
        }
        break;
    }

    processed.processingTimeMs = Date.now() - startTime;
    return processed;

  } catch (error: any) {
    console.error(`Error processing page ${page.pageNumber}:`, error);
    processed.error = error.message;
    processed.processingTimeMs = Date.now() - startTime;
    return processed;
  }
}

/**
 * Process all pages of a PDF document
 * 
 * @param pages - Array of page content from PDF extraction
 * @param onProgress - Optional callback for progress updates
 * @returns Array of processed pages
 */
export async function processAllPages(
  pages: PDFPageContent[],
  onProgress?: (current: number, total: number, status: string) => void
): Promise<ProcessedPage[]> {
  const results: ProcessedPage[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    
    if (onProgress) {
      onProgress(
        i + 1,
        pages.length,
        `Processing page ${page.pageNumber}...`
      );
    }

    const processed = await processPage(page, {
      useVisionForScanned: true,
      analyzeDiagrams: true,
    });

    results.push(processed);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate if a PDF page is primarily a diagram/chart vs text document
 * 
 * @param page - The page content
 * @returns True if the page appears to be primarily visual
 */
export function isPagePrimarilyDiagram(page: PDFPageContent): boolean {
  // Heuristics for detecting diagram-heavy pages:
  // - Very little text (< 100 characters)
  // - Has image data
  // - Text is sparse or appears to be labels only

  if (!page.hasText || page.extractedText.trim().length < 100) {
    return true;
  }

  // Check for diagram indicators in text
  const diagramKeywords = ['generation', 'branch', 'tree', 'chart', 'diagram'];
  const hasIndicators = diagramKeywords.some(keyword =>
    page.extractedText.toLowerCase().includes(keyword)
  );

  return hasIndicators && page.extractedText.trim().length < 500;
}

/**
 * Clean and normalize extracted text
 * 
 * @param text - Raw extracted text
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
    .trim();
}

/**
 * Split text into logical sections (e.g., by generation, family branch)
 * 
 * @param text - Extracted text from page
 * @returns Array of text sections
 */
export function splitIntoSections(text: string): string[] {
  // Common section delimiters in genealogy documents
  const delimiters = [
    /generation\s+[a-zA-Z0-9]+/i,
    /branch:/i,
    /family\s+of/i,
    /descendants\s+of/i,
    /children:/i,
  ];

  const sections: string[] = [];
  let currentSection = '';
  const lines = text.split('\n');

  for (const line of lines) {
    const isDelimiter = delimiters.some(pattern => pattern.test(line));
    
    if (isDelimiter && currentSection.trim()) {
      sections.push(currentSection.trim());
      currentSection = line;
    } else {
      currentSection += '\n' + line;
    }
  }

  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }

  return sections.filter(s => s.length > 10); // Filter out very short sections
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT MAIN PROCESSING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point: Process a PDF file completely
 * 
 * @param file - The PDF file to process
 * @param onProgress - Optional callback for progress updates
 * @returns Complete processing results
 */
export async function processPDFFile(
  file: File,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<{
  pages: ProcessedPage[];
  totalPages: number;
  totalProcessingTimeMs: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Stage 1: Extract PDF content
    if (onProgress) onProgress('Extracting PDF content', 0, 2);
    
    const extractionResult = await extractPDFContent(file, (progress) => {
      if (onProgress) {
        onProgress(
          'Extracting PDF content',
          progress.currentPage,
          progress.totalPages
        );
      }
    });

    errors.push(...extractionResult.errors);

    // Stage 2: Process each page
    if (onProgress) onProgress('Processing pages', 0, extractionResult.pages.length);
    
    const processedPages = await processAllPages(
      extractionResult.pages,
      (current, total, status) => {
        if (onProgress) {
          onProgress('Processing pages', current, total);
        }
      }
    );

    // Collect errors from page processing
    processedPages.forEach(page => {
      if (page.error) {
        errors.push(`Page ${page.pageNumber}: ${page.error}`);
      }
    });

    return {
      pages: processedPages,
      totalPages: extractionResult.totalPages,
      totalProcessingTimeMs: Date.now() - startTime,
      errors,
    };

  } catch (error: any) {
    console.error('PDF processing failed:', error);
    errors.push(error.message || 'PDF processing failed');
    
    return {
      pages: [],
      totalPages: 0,
      totalProcessingTimeMs: Date.now() - startTime,
      errors,
    };
  }
}
