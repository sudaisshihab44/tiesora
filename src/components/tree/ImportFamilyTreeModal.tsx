import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  Trash2,
  FileUp,
} from 'lucide-react';
import { ImportReviewDashboard } from '../import/ImportReviewDashboard';
import { executeImportTransaction } from '../../services/importTransaction';

interface ImportFamilyTreeModalProps {
  familyId: string;
  familyName: string;
  onClose: () => void;
  onImportComplete: () => void;
}

type ModalStep = 'upload' | 'processing' | 'review' | 'importing';

export const ImportFamilyTreeModal: React.FC<ImportFamilyTreeModalProps> = ({
  familyId,
  familyName,
  onClose,
  onImportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal flow state
  const [currentStep, setCurrentStep] = useState<ModalStep>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Extraction progress / ETA
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionMessage, setExtractionMessage] = useState('Preparing document...');
  const [extractionEtaMs, setExtractionEtaMs] = useState<number | null>(null);
  const [estimatedTotalMs, setEstimatedTotalMs] = useState<number | null>(null);

  // Validation constants
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_PAGES = 200; // Reasonable limit for genealogy documents
  const ALLOWED_MIME_TYPES = ['application/pdf'];

  // Validate PDF file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only PDF files are supported' };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File size exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit` 
      };
    }

    // Check file name
    if (file.name.length > 255) {
      return { valid: false, error: 'File name is too long' };
    }

    return { valid: true };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setUploadStatus('idle');

    // Generate preview (first page thumbnail would require PDF.js - simplified for now)
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }, [validateFile]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // File input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Upload and analyze PDF
  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a PDF file');
      return;
    }

    console.log('📤 [Upload] Starting upload:', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      familyId: familyId,
    });

    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage(null);
    setExtractionProgress(0);
    setExtractionMessage('Preparing document...');
    setExtractionEtaMs(null);
    setEstimatedTotalMs(null);

    try {
      // Upload PDF to Supabase Storage and create import job
      const { uploadPDFForImport } = await import('../../services/pdfImport');
      
      console.log('📤 [Upload] Calling uploadPDFForImport...');
      const result = await uploadPDFForImport(
        familyId,
        selectedFile,
        (progress) => {
          console.log(`📤 [Upload] Progress: ${progress}%`);
          setUploadProgress(progress);
        }
      );

      console.log('📤 [Upload] Result:', result);

      if (!result.ok || !result.jobId) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log('✅ [Upload] Upload successful! Job ID:', result.jobId);
      setUploadStatus('success');
      setJobId(result.jobId);
      
      // Move to processing step
      setCurrentStep('processing');
      
      // Start AI extraction
      await startAIExtraction(result.jobId);

    } catch (error: any) {
      console.error('❌ [Upload] Upload error:', error);
      setUploadStatus('error');
      
      let errorMsg = error.message || 'Failed to upload PDF. Please try again.';
      
      // Provide specific error messages for common issues
      if (errorMsg.includes('bucket') || errorMsg.includes('storage')) {
        errorMsg = 'Storage bucket not configured. Please contact your administrator to set up the "family-import-pdfs" bucket in Supabase Storage.';
      } else if (errorMsg.includes('permission') || errorMsg.includes('policy')) {
        errorMsg = 'You do not have permission to upload PDFs. Please contact your family administrator.';
      } else if (errorMsg.includes('size')) {
        errorMsg = 'File is too large. Maximum size is 50MB.';
      }
      
      setErrorMessage(errorMsg);
      setUploadProgress(0);
    }
  };

  // Start AI extraction process
  const startAIExtraction = async (importJobId: string) => {
    try {
      console.log('🤖 [Extraction] Starting AI extraction for job:', importJobId);
      
      const { supabase } = await import('../../services/supabase');
      const { processPDFFile } = await import('../../services/pdfProcessor');
      const { extractFamilyDataFromPDF } = await import('../../services/aiExtractor');
      
      // First, get the job details to find the PDF file path
      console.log('🤖 [Extraction] Loading job details...');
      const { data: job, error: jobError } = await supabase!
        .from('family_import_jobs')
        .select('*')
        .eq('id', importJobId)
        .single();
      
      if (jobError || !job) {
        console.error('❌ [Extraction] Failed to load job:', jobError);
        throw new Error('Failed to load import job details');
      }
      
      console.log('✅ [Extraction] Job loaded:', job);
      
      // Download the PDF file from storage
      console.log('📥 [Extraction] Downloading PDF from storage:', job.file_path);
      const { data: fileData, error: downloadError } = await supabase!
        .storage
        .from('family-import-pdfs')
        .download(job.file_path);
      
      if (downloadError || !fileData) {
        console.error('❌ [Extraction] Download failed:', downloadError);
        throw new Error('Failed to download PDF file');
      }
      
      console.log('✅ [Extraction] PDF downloaded, size:', fileData.size, 'bytes');
      
      // Convert blob to File object
      const pdfFile = new File([fileData], job.file_name, { type: 'application/pdf' });
      
      // Process the PDF to extract pages
      console.log('📄 [Extraction] Processing PDF pages...');
      const processResult = await processPDFFile(pdfFile);
      
      if (processResult.errors.length > 0) {
        console.warn('⚠️ [Extraction] PDF processing had errors:', processResult.errors);
      }
      
      if (processResult.pages.length === 0) {
        console.error('❌ [Extraction] No pages extracted');
        throw new Error('No pages extracted from PDF');
      }
      
      console.log(`✅ [Extraction] Extracted ${processResult.pages.length} pages`);

      const batchCount = Math.max(1, Math.ceil(processResult.pages.length / 3));
      const initialEstimateMs = Math.max(2 * 60_000, batchCount * 45_000);
      const extractionStartedAt = Date.now();

      setEstimatedTotalMs(initialEstimateMs);
      setExtractionEtaMs(initialEstimateMs);
      setExtractionProgress(5);
      setExtractionMessage(
        `Analyzing ${processResult.pages.length} pages in ${batchCount} batches...`,
      );
      
      // Then extract family data from the processed pages
      console.log('🤖 [Extraction] Running AI extraction...');
      const extractResult = await extractFamilyDataFromPDF(
        processResult.pages,
        importJobId,
        familyId,
        (progress) => {
          setExtractionProgress(progress.progress);
          setExtractionMessage(progress.message);

          const elapsed = Date.now() - extractionStartedAt;
          if (progress.progress >= 100) {
            setExtractionEtaMs(0);
          } else if (progress.progress >= 10 && elapsed > 5_000) {
            const estimatedTotal = (elapsed / progress.progress) * 100;
            setExtractionEtaMs(Math.max(0, estimatedTotal - elapsed));
          }
        },
      );
      
      console.log('🤖 [Extraction] Extraction result:', extractResult);
      
      if (!extractResult.success) {
        console.error('❌ [Extraction] AI extraction failed:', extractResult.error);
        throw new Error(extractResult.error || 'Failed to extract family data');
      }
      
      console.log('✅ [Extraction] Extraction complete! Moving to review...');
      
      // Move to review step
      setCurrentStep('review');
    } catch (error: any) {
      console.error('❌ [Extraction] Extraction error:', error);
      setErrorMessage(error.message || 'Failed to extract family data. Please try again.');
      setCurrentStep('upload');
    }
  };

  // Handle approval and import
  const handleApproveImport = async () => {
    if (!jobId) return;

    setCurrentStep('importing');

    try {
      const result = await executeImportTransaction(jobId, familyId);

      if (result.success) {
        // Notify parent and close
        onImportComplete();
        onClose();
      } else {
        setErrorMessage(
          `Import completed with ${result.errors.length} errors. ` +
          `Imported: ${result.importedPeople} people, ${result.importedRelationships} relationships.`
        );
        setCurrentStep('review');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setErrorMessage(error.message || 'Failed to import family data.');
      setCurrentStep('review');
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    return `${Math.ceil(seconds / 60)} min`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Show review dashboard if in review step
  if (currentStep === 'review' && jobId) {
    return (
      <ImportReviewDashboard
        jobId={jobId}
        familyId={familyId}
        onClose={onClose}
        onApprove={handleApproveImport}
      />
    );
  }

  // Show processing overlay
  if (currentStep === 'processing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Loader2 size={64} className="text-[#285C43] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Analyzing Your Family Tree
            </h3>
            <p className="text-gray-600 mb-4">
              Our AI is extracting family members, relationships, and genealogical data from your PDF.
              {estimatedTotalMs
                ? ` Estimated time: about ${formatDuration(estimatedTotalMs)}; the estimate updates as batches complete.`
                : ' This may take several minutes for large documents.'}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-3">
              <div className="flex items-start gap-2 text-sm text-blue-800">
                <Loader2 size={16} className="animate-spin flex-shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">
                  Processing {selectedFile?.name || 'PDF'}...
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-blue-800 mb-1">
                  <span className="pr-3">{extractionMessage}</span>
                  <span className="tabular-nums font-semibold">
                    {Math.min(100, Math.round(extractionProgress))}%
                  </span>
                </div>
                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#285C43] transition-all duration-500"
                    style={{ width: `${Math.min(100, extractionProgress)}%` }}
                  />
                </div>
                <p className="text-[11px] text-blue-600 mt-1.5">
                  {extractionEtaMs !== null && extractionEtaMs > 0
                    ? `About ${formatDuration(extractionEtaMs)} remaining`
                    : extractionProgress >= 100
                      ? 'Finishing up...'
                      : 'Estimating remaining time...'}
                  {' · '}
                  Keep this tab open; times are approximate.
                </p>
              </div>

              <div className="text-xs text-blue-600 ml-6">
                • Reading pages and extracting text
                <br />• Analyzing family relationships with AI
                <br />• Validating and deduplicating records
                <br />• Saving results to the review database
              </div>
            </div>
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show importing overlay
  if (currentStep === 'importing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Loader2 size={64} className="text-[#285C43] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Importing Family Tree
            </h3>
            <p className="text-gray-600">
              Adding verified family members and relationships to {familyName}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#285C43] to-[#193D2D] text-white px-6 py-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileUp size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Import Family Tree</h2>
              <p className="text-sm text-emerald-100/80 mt-0.5">
                Upload a genealogy PDF for {familyName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Upload Area */}
          {!selectedFile ? (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                ${isDragging 
                  ? 'border-[#285C43] bg-[#E7F0E8]' 
                  : 'border-gray-300 hover:border-[#285C43]/50 bg-gray-50/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-[#E7F0E8] rounded-full">
                  <Upload size={32} className="text-[#285C43]" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Drop your genealogy PDF here
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    or click to browse your files
                  </p>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#285C43] text-white font-medium rounded-lg hover:bg-[#193D2D] transition-colors"
                  >
                    Browse Files
                  </button>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>✓ PDF files only</p>
                  <p>✓ Maximum size: 50MB</p>
                  <p>✓ Up to 200 pages supported</p>
                </div>
              </div>
            </div>
          ) : (
            /* File Preview */
            <div className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
              <div className="flex items-start gap-4">
                {/* PDF Icon */}
                <div className="flex-shrink-0 p-3 bg-red-100 rounded-lg">
                  <FileText size={32} className="text-red-600" />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {selectedFile.name}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatFileSize(selectedFile.size)}
                  </p>
                  {uploadStatus === 'idle' && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Upload is quick. AI analysis can take 10-30 minutes for
                      large genealogy PDFs; a live estimate appears during
                      processing.
                    </p>
                  )}

                  {/* Status Indicator */}
                  {uploadStatus === 'success' && (
                    <div className="flex items-center gap-2 mt-2 text-green-600">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">Upload successful</span>
                    </div>
                  )}

                  {uploadStatus === 'uploading' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>
                          Uploading...
                          {selectedFile
                            ? ` (~${Math.max(
                                1,
                                Math.ceil(selectedFile.size / (512 * 1024)),
                              )}s)`
                            : ''}
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#285C43] transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                {uploadStatus === 'idle' && (
                  <button
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 text-sm">Upload Error</h4>
                <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">
              What happens next?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">1.</span>
                <span>Your PDF will be analyzed using AI to extract family members and relationships</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">2.</span>
                <span>You'll review and verify the extracted information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">3.</span>
                <span>After approval, the family tree will be added to {familyName}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">4.</span>
                <span>
                  Typical AI analysis: 15-30 minutes for a 60-page PDF. The
                  processing screen shows a live progress bar and estimate.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            disabled={uploadStatus === 'uploading'}
          >
            Cancel
          </button>

          <button
            onClick={handleUploadAndAnalyze}
            disabled={!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'success'}
            className="
              px-6 py-2 bg-[#285C43] text-white font-semibold rounded-lg
              hover:bg-[#193D2D] disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors flex items-center gap-2
            "
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : uploadStatus === 'success' ? (
              <>
                <CheckCircle2 size={18} />
                Uploaded
              </>
            ) : (
              <>
                <FileUp size={18} />
                Upload & Analyze
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
