import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FamilyPerson, 
  Relationship, 
  RelationshipType, 
  Gender, 
  LivingStatus, 
  DatePrecision,
  UserProfile,
} from '../../types';
import {
  createPersonAction,
  createRelationshipAction,
  updatePersonAction,
  uploadProfilePhotoAction,
  deleteFamilyPhotoAction,
} from '../../services/dataActions';
import { FamilyImage } from '../common/FamilyImage';
import {
  PROFILE_PHOTO_ACCEPT,
  prepareProfilePhoto,
  validateProfilePhoto,
} from '../../utils/image';
import { 
  X, 
  UserPlus, 
  AlertCircle, 
  Check, 
  Search, 
  Heart, 
  Calendar, 
  FileText, 
  Link as LinkIcon,
  Camera,
  Loader2,
} from 'lucide-react';

interface AddRelativeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  currentUser: UserProfile;
  targetPerson?: FamilyPerson; // When adding relative TO someone
  editPerson?: FamilyPerson;   // When editing an existing person
  people: FamilyPerson[];
  relationships: Relationship[];
  onSaved: (person: FamilyPerson) => void;
}

export const AddRelativeDialog: React.FC<AddRelativeDialogProps> = ({
  isOpen,
  onClose,
  familyId,
  currentUser,
  targetPerson,
  editPerson,
  people,
  relationships,
  onSaved,
}) => {
  const isEditing = Boolean(editPerson);

  // Form states
  const [fullName, setFullName] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [livingStatus, setLivingStatus] = useState<LivingStatus>('living');
  const [birthDate, setBirthDate] = useState<string>('');
  const [birthPlace, setBirthPlace] = useState<string>('');
  const [deathDate, setDeathDate] = useState<string>('');
  const [deathPlace, setDeathPlace] = useState<string>('');
  const [datePrecision, setDatePrecision] = useState<DatePrecision>('exact');
  const [biography, setBiography] = useState<string>('');
  const [avatarPath, setAvatarPath] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreparing, setAvatarPreparing] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [branch, setBranch] = useState<string>('Paternal');

  // Relationship mode
  const [connectExistingMode, setConnectExistingMode] = useState<boolean>(false);
  const [selectedExistingPersonId, setSelectedExistingPersonId] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType | 'sibling'>('child');
  const [relationshipNotes, setRelationshipNotes] = useState<string>('');

  // Validation & feedback
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Initialize or reset form
  useEffect(() => {
    if (editPerson) {
      setFullName(editPerson.full_name);
      setDisplayName(editPerson.display_name);
      setGender(editPerson.gender);
      setLivingStatus(editPerson.living_status);
      setBirthDate(editPerson.birth_date || '');
      setBirthPlace(editPerson.birth_place || '');
      setDeathDate(editPerson.death_date || '');
      setDeathPlace(editPerson.death_place || '');
      setDatePrecision(editPerson.date_precision);
      setBiography(editPerson.biography || '');
      setAvatarPath(editPerson.avatar_path || '');
      setBranch(editPerson.branch || 'Paternal');
      setConnectExistingMode(false);
    } else {
      setFullName('');
      setDisplayName('');
      setGender('unspecified');
      setLivingStatus('living');
      setBirthDate('');
      setBirthPlace('');
      setDeathDate('');
      setDeathPlace('');
      setDatePrecision('exact');
      setBiography('');
      setAvatarPath('');
      setBranch(targetPerson?.branch || 'Paternal');
      setConnectExistingMode(false);
      setSelectedExistingPersonId('');
      setRelationshipType('child');
      setRelationshipNotes('');
    }
    setError(null);
    setSaving(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setAvatarUploading(false);
    setAvatarPreparing(false);
    setAvatarProgress(0);
  }, [editPerson, targetPerson, isOpen]);

  const handleAvatarSelect = async (file: File | undefined) => {
    setAvatarError(null);
    if (!file) return;
    const validationError = validateProfilePhoto(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarPreparing(true);
    try {
      const prepared = await prepareProfilePhoto(file);
      setAvatarFile(prepared);
      setAvatarPreview(URL.createObjectURL(prepared));
      setAvatarPath('');
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Could not prepare that image.',
      );
    } finally {
      setAvatarPreparing(false);
    }
  };

  const handleAvatarDrop = (event: React.DragEvent) => {
    event.preventDefault();
    void handleAvatarSelect(event.dataTransfer.files?.[0]);
  };

  // Auto-fill display name if empty when full name changes
  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (!editPerson && (!displayName || displayName === fullName.split(' ')[0])) {
      setDisplayName(val);
    }
  };

  // Duplicate detection candidate warning
  const duplicateCandidates = useMemo(() => {
    if (isEditing || !fullName.trim()) return [];
    const query = fullName.trim().toLowerCase();
    return people.filter(p =>
      p.full_name.toLowerCase().includes(query) ||
      p.display_name.toLowerCase().includes(query)
    );
  }, [fullName, people, isEditing]);

  // Calculate live relationship explanation preview
  const relationshipExplanation = useMemo(() => {
    if (!targetPerson) return null;
    const nameA = targetPerson.display_name;
    const nameB = connectExistingMode
      ? people.find(p => p.id === selectedExistingPersonId)?.display_name || 'Selected Relative'
      : displayName || fullName || 'New Relative';

    switch (relationshipType) {
      case 'parent':
        return `${nameB} will be recorded as the biological parent of ${nameA}.`;
      case 'child':
        return `${nameB} will be recorded as the biological child of ${nameA}.`;
      case 'sibling':
        return `${nameB} will be recorded as a sibling to ${nameA} (Generation ${targetPerson.generation_level}).`;
      case 'spouse':
        return `${nameA} and ${nameB} will be linked as spouses/partners.`;
      case 'step_parent':
        return `${nameB} will be recorded as step-parent of ${nameA}.`;
      case 'adoptive_parent':
        return `${nameB} will be recorded as adoptive parent of ${nameA}.`;
      default:
        return `Establishing connection between ${nameA} and ${nameB}.`;
    }
  }, [targetPerson, displayName, fullName, connectExistingMode, selectedExistingPersonId, relationshipType, people]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!isEditing && !connectExistingMode && !displayName.trim()) {
      setError('Please provide at least a display name.');
      return;
    }

    if (birthDate && deathDate && birthDate > deathDate) {
      setError('Date of birth cannot be after date of death.');
      return;
    }

    setSaving(true);
    let pendingUploadedPath: string | undefined;

    try {
      if (isEditing && editPerson) {
        let resolvedAvatarPath = avatarPath.trim() || undefined;

        if (avatarFile) {
          setAvatarUploading(true);
          setAvatarProgress(0);
          try {
            resolvedAvatarPath = await uploadProfilePhotoAction(
              avatarFile,
              familyId,
              editPerson.id,
              setAvatarProgress,
            );
            if (resolvedAvatarPath !== editPerson.avatar_path) {
              pendingUploadedPath = resolvedAvatarPath;
            }
          } catch (uploadError) {
            const message =
              uploadError instanceof Error
                ? uploadError.message
                : String(uploadError);
            setAvatarError(message);
            setError(
              `Photo upload failed: ${message}. Your existing photo was kept.`,
            );
            setSaving(false);
            return;
          } finally {
            setAvatarUploading(false);
          }
        }

        const updated = await updatePersonAction(editPerson.id, {
          full_name: fullName.trim() || displayName.trim(),
          display_name: displayName.trim(),
          gender,
          living_status: livingStatus,
          birth_date: birthDate || undefined,
          birth_place: birthPlace.trim() || undefined,
          death_date: deathDate || undefined,
          death_place: deathPlace.trim() || undefined,
          date_precision: datePrecision,
          biography: biography.trim() || undefined,
          avatar_path: resolvedAvatarPath ?? null,
          branch,
        });

        if (
          editPerson.avatar_path &&
          editPerson.avatar_path !== resolvedAvatarPath
        ) {
          void deleteFamilyPhotoAction(editPerson.avatar_path).catch((error) => {
            console.warn('[AddRelativeDialog] old photo cleanup failed:', error);
          });
        }
        pendingUploadedPath = undefined;
        onSaved(updated);
        onClose();
        return;
      }

      // Connect existing person mode
      if (connectExistingMode) {
        if (!selectedExistingPersonId) {
          setError('Please select an existing family member to connect.');
          return;
        }
        if (!targetPerson) {
          setError('Target family member is required to form a relationship.');
          return;
        }

        if (
          relationshipType === 'parent' ||
          relationshipType === 'adoptive_parent' ||
          relationshipType === 'step_parent'
        ) {
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: selectedExistingPersonId,
              target_person_id: targetPerson.id,
              relationship_type: relationshipType,
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        } else if (relationshipType === 'child') {
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: targetPerson.id,
              target_person_id: selectedExistingPersonId,
              relationship_type: 'parent',
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        } else if (relationshipType === 'sibling') {
          const parentRels = relationships.filter(
            (r) =>
              r.target_person_id === targetPerson.id &&
              ['parent', 'adoptive_parent', 'step_parent'].includes(
                r.relationship_type,
              ),
          );

          if (parentRels.length > 0) {
            for (const pr of parentRels) {
              await createRelationshipAction(
                {
                  family_id: familyId,
                  source_person_id: pr.source_person_id,
                  target_person_id: selectedExistingPersonId,
                  relationship_type: pr.relationship_type,
                  relationship_status: 'verified',
                  notes: relationshipNotes.trim() || undefined,
                },
                currentUser,
              );
            }
          } else {
            const sharedParent = await createPersonAction(
              {
                family_id: familyId,
                full_name: `Parent of ${targetPerson.display_name}`,
                display_name: `Parent of ${targetPerson.display_name}`,
                gender: 'unspecified',
                living_status: 'unknown',
                date_precision: 'unknown',
                generation_level: Math.max(
                  1,
                  targetPerson.generation_level - 1,
                ),
                branch: targetPerson.branch,
              },
              currentUser,
            );

            await createRelationshipAction(
              {
                family_id: familyId,
                source_person_id: sharedParent.id,
                target_person_id: targetPerson.id,
                relationship_type: 'parent',
                relationship_status: 'verified',
              },
              currentUser,
            );
            await createRelationshipAction(
              {
                family_id: familyId,
                source_person_id: sharedParent.id,
                target_person_id: selectedExistingPersonId,
                relationship_type: 'parent',
                relationship_status: 'verified',
              },
              currentUser,
            );
          }
        } else {
          // Spouse / Partner
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: targetPerson.id,
              target_person_id: selectedExistingPersonId,
              relationship_type: 'spouse',
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        }

        const connectedPerson = people.find(
          (p) => p.id === selectedExistingPersonId,
        );
        if (connectedPerson) onSaved(connectedPerson);
        onClose();
        return;
      }

      // Calculate generation level
      let genLevel = targetPerson ? targetPerson.generation_level : 2;
      if (targetPerson) {
        if (
          relationshipType === 'parent' ||
          relationshipType === 'adoptive_parent' ||
          relationshipType === 'step_parent'
        ) {
          genLevel = Math.max(1, targetPerson.generation_level - 1);
        } else if (relationshipType === 'child') {
          genLevel = targetPerson.generation_level + 1;
        } else {
          genLevel = targetPerson.generation_level;
        }
      }

      // Create new person
      const memberId = crypto.randomUUID();
      let resolvedAvatarPath = avatarPath.trim() || undefined;

      if (avatarFile) {
        setAvatarUploading(true);
        setAvatarProgress(0);
        try {
          resolvedAvatarPath = await uploadProfilePhotoAction(
            avatarFile,
            familyId,
            memberId,
            setAvatarProgress,
          );
          pendingUploadedPath = resolvedAvatarPath;
        } catch (uploadError) {
          const message =
            uploadError instanceof Error
              ? uploadError.message
              : String(uploadError);
          setAvatarError(message);
          setError(`Photo upload failed: ${message}.`);
          setSaving(false);
          return;
        } finally {
          setAvatarUploading(false);
        }
      }

      const newPerson = await createPersonAction(
        {
          id: memberId,
          family_id: familyId,
          full_name: fullName.trim() || displayName.trim(),
          display_name: displayName.trim(),
          gender,
          living_status: livingStatus,
          birth_date: birthDate || undefined,
          birth_place: birthPlace.trim() || undefined,
          death_date: deathDate || undefined,
          death_place: deathPlace.trim() || undefined,
          date_precision: datePrecision,
          biography: biography.trim() || undefined,
          avatar_path: resolvedAvatarPath,
          generation_level: genLevel,
          branch,
        },
        currentUser,
      );

      // Create relationship if targetPerson exists
      if (targetPerson) {
        if (
          relationshipType === 'parent' ||
          relationshipType === 'adoptive_parent' ||
          relationshipType === 'step_parent'
        ) {
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: newPerson.id,
              target_person_id: targetPerson.id,
              relationship_type: relationshipType,
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        } else if (relationshipType === 'child') {
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: targetPerson.id,
              target_person_id: newPerson.id,
              relationship_type: 'parent',
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        } else if (relationshipType === 'sibling') {
          const parentRels = relationships.filter(
            (r) =>
              r.target_person_id === targetPerson.id &&
              ['parent', 'adoptive_parent', 'step_parent'].includes(
                r.relationship_type,
              ),
          );

          if (parentRels.length > 0) {
            for (const pr of parentRels) {
              await createRelationshipAction(
                {
                  family_id: familyId,
                  source_person_id: pr.source_person_id,
                  target_person_id: newPerson.id,
                  relationship_type: pr.relationship_type,
                  relationship_status: 'verified',
                  notes: relationshipNotes.trim() || undefined,
                },
                currentUser,
              );
            }
          } else {
            const sharedParent = await createPersonAction(
              {
                family_id: familyId,
                full_name: `Parent of ${targetPerson.display_name}`,
                display_name: `Parent of ${targetPerson.display_name}`,
                gender: 'unspecified',
                living_status: 'unknown',
                date_precision: 'unknown',
                generation_level: Math.max(
                  1,
                  targetPerson.generation_level - 1,
                ),
                branch: targetPerson.branch,
              },
              currentUser,
            );

            await createRelationshipAction(
              {
                family_id: familyId,
                source_person_id: sharedParent.id,
                target_person_id: targetPerson.id,
                relationship_type: 'parent',
                relationship_status: 'verified',
              },
              currentUser,
            );
            await createRelationshipAction(
              {
                family_id: familyId,
                source_person_id: sharedParent.id,
                target_person_id: newPerson.id,
                relationship_type: 'parent',
                relationship_status: 'verified',
              },
              currentUser,
            );
          }
        } else {
          // Spouse
          await createRelationshipAction(
            {
              family_id: familyId,
              source_person_id: targetPerson.id,
              target_person_id: newPerson.id,
              relationship_type: 'spouse',
              relationship_status: 'verified',
              notes: relationshipNotes.trim() || undefined,
            },
            currentUser,
          );
        }
      }

      onSaved(newPerson);
      pendingUploadedPath = undefined;
      onClose();
    } catch (err) {
      if (pendingUploadedPath) {
        void deleteFamilyPhotoAction(pendingUploadedPath).catch((cleanupError) => {
          console.warn('[AddRelativeDialog] uploaded photo cleanup failed:', cleanupError);
        });
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AddRelativeDialog] save failed:', err);
      setError(message);
    } finally {
      setSaving(false);
      setAvatarUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl max-w-xl w-full overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150 max-h-[90vh] sm:max-h-none flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/70">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {isEditing
                ? `Edit ${editPerson?.display_name}`
                : targetPerson
                ? `Add Relative to ${targetPerson.display_name}`
                : 'Add Family Member'}
            </h3>
            {targetPerson && !isEditing && (
              <p className="text-xs text-stone-500 mt-0.5">
                Connecting to {targetPerson.display_name} (Generation {targetPerson.generation_level})
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Relationship Connection Selector (Only when targetPerson exists and not editing) */}
          {targetPerson && !isEditing && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-900/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-emerald-950">
                  Relationship to {targetPerson.display_name}
                </label>
                <button
                  type="button"
                  onClick={() => setConnectExistingMode(!connectExistingMode)}
                  className="text-xs text-emerald-800 hover:text-emerald-950 font-medium underline"
                >
                  {connectExistingMode ? 'Create New Member' : 'Connect Existing Member Instead'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { type: 'child', label: 'Child' },
                  { type: 'parent', label: 'Parent' },
                  { type: 'sibling', label: 'Sibling' },
                  { type: 'spouse', label: 'Spouse / Partner' },
                  { type: 'adoptive_parent', label: 'Adoptive Parent' },
                  { type: 'step_parent', label: 'Step Parent' },
                ].map(item => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setRelationshipType(item.type as any)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                      relationshipType === item.type
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:border-emerald-700/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Relationship Explanation Preview */}
              {relationshipExplanation && (
                <p className="text-xs text-emerald-900/80 italic pt-1">
                  💡 {relationshipExplanation}
                </p>
              )}

              {/* Connect Existing Member Picker */}
              {connectExistingMode && (
                <div className="pt-2 border-t border-emerald-900/10">
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Select an existing relative to link:
                  </label>
                  <select
                    value={selectedExistingPersonId}
                    onChange={(e) => setSelectedExistingPersonId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                  >
                    <option value="">-- Choose from existing family members --</option>
                    {people
                      .filter(p => p.id !== targetPerson.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.display_name} ({p.full_name}) · Gen {p.generation_level}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* New Member or Edit Details */}
          {!connectExistingMode && (
            <>
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eleanor Vance"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Eleanor Ward Vance"
                    value={fullName}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              {/* Duplicate Candidate Alert */}
              {duplicateCandidates.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Possible duplicate detected:
                  </p>
                  <p className="text-[11px] text-amber-800 mt-1">
                    "{duplicateCandidates.map(c => c.display_name).join(', ')}" is already in your family tree.
                  </p>
                </div>
              )}

              {/* Gender and Living Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                  >
                    <option value="unspecified">Unspecified / Choose Later</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other / Non-Binary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={livingStatus}
                    onChange={(e) => setLivingStatus(e.target.value as LivingStatus)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                  >
                    <option value="living">Living</option>
                    <option value="deceased">Deceased</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>

              {/* Dates & Places */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Birthplace (City, State / Country)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Boston, MA"
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                    />
                  </div>
                </div>

                {livingStatus === 'deceased' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Date of Death
                      </label>
                      <input
                        type="date"
                        value={deathDate}
                        onChange={(e) => setDeathDate(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Place of Death
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Concord, MA"
                        value={deathPlace}
                        onChange={(e) => setDeathPlace(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Biography / Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Biography & Life Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Key milestones, passions, professions, or memories..."
                  value={biography}
                  onChange={(e) => setBiography(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 resize-none"
                />
              </div>

              {/* Avatar Path & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Family Branch
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paternal, Maternal, Vance, Chen"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Profile Photo
                  </label>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept={PROFILE_PHOTO_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      void handleAvatarSelect(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <div
                    onClick={() => {
                      if (!avatarPreparing && !avatarUploading && !saving) {
                        avatarInputRef.current?.click();
                      }
                    }}
                    onDrop={handleAvatarDrop}
                    onDragOver={(event) => event.preventDefault()}
                    className="border-2 border-dashed border-stone-300 hover:border-emerald-600/60 rounded-xl p-3 bg-stone-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-stone-200 flex items-center justify-center shrink-0">
                        {avatarPreview || avatarPath ? (
                          <FamilyImage
                            src={avatarPreview || avatarPath}
                            alt="Profile preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-6 h-6 text-stone-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-semibold text-stone-800">
                          {avatarPreview || avatarPath
                            ? 'Change profile photo'
                            : 'Upload profile photo'}
                        </p>
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                          Drag & drop or click to browse. JPG, JPEG, PNG, WEBP —
                          maximum 5 MB. Large images are resized automatically.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              avatarInputRef.current?.click();
                            }}
                            disabled={avatarPreparing || avatarUploading || saving}
                            className="px-2.5 py-1 border border-stone-300 rounded-lg text-[11px] font-medium text-stone-700 hover:bg-white disabled:opacity-50 flex items-center gap-1"
                          >
                            {avatarPreparing || avatarUploading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Camera className="w-3 h-3" />
                            )}
                            {avatarPreview || avatarPath ? 'Change' : 'Choose photo'}
                          </button>
                          {(avatarPreview || avatarPath) && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAvatarFile(null);
                                setAvatarPreview(null);
                                setAvatarPath('');
                                setAvatarError(null);
                              }}
                              disabled={avatarUploading || saving}
                              className="text-[11px] text-rose-600 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {avatarPreparing && (
                    <p className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Preparing image…
                    </p>
                  )}
                  {avatarUploading && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                        <span>Uploading photo…</span>
                        <span className="tabular-nums">{avatarProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 transition-all duration-300"
                          style={{ width: `${avatarProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {avatarError && (
                    <p className="text-[11px] text-rose-600 mt-1.5">{avatarError}</p>
                  )}

                  <input
                    type="url"
                    placeholder="Or paste an image URL: https://..."
                    value={avatarPath}
                    onChange={(e) => {
                      setAvatarPath(e.target.value);
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setAvatarError(null);
                    }}
                    className="w-full mt-2 text-xs px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all"
            >
              {saving
                ? 'Saving…'
                : isEditing
                  ? 'Save Changes'
                  : connectExistingMode
                    ? 'Link Relative'
                    : 'Save & Add to Tree'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
