import React, { useState } from 'react';
import { storage } from '../../services/storage';
import { Family, FamilyPerson, RelationshipType } from '../../types';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Users, 
  UserPlus, 
  GitFork, 
  Send, 
  X, 
  ShieldCheck 
} from 'lucide-react';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState(1);

  // Step 2 state
  const [familyName, setFamilyName] = useState('');
  const [familyDescription, setFamilyDescription] = useState('');
  const [preferredLang, setPreferredLang] = useState('en');
  const [createdFamily, setCreatedFamily] = useState<Family | null>(null);

  // Step 3 state (First Member)
  const [selfName, setSelfName] = useState('');
  const [selfBirthYear, setSelfBirthYear] = useState('');
  const [firstPerson, setFirstPerson] = useState<FamilyPerson | null>(null);

  // Step 4 state (Second Member / Relative)
  const [relativeName, setRelativeName] = useState('');
  const [relativeRelation, setRelativeRelation] = useState<RelationshipType>('parent');

  // Step 6 state (Invite relative)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  if (!isOpen) return null;

  const currentUser = storage.getCurrentUser();

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;

    const fam = storage.createFamily({
      name: familyName.trim(),
      description: familyDescription.trim() || undefined,
      owner_id: currentUser.id,
      privacy_settings: {
        hideLivingDates: false,
        hideLivingBiographies: false,
        hidePrivateMemories: false,
        requireAdminApprovalForEdits: true,
        isPubliclySearchable: false,
      },
    });
    setCreatedFamily(fam);
    setStep(3);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfName.trim() || !createdFamily) return;

    const person = storage.addPerson({
      family_id: createdFamily.id,
      full_name: selfName.trim(),
      display_name: selfName.trim(),
      gender: 'unspecified',
      living_status: 'living',
      birth_date: selfBirthYear ? `${selfBirthYear}-01-01` : undefined,
      date_precision: 'about',
      generation_level: 2,
      created_by: currentUser.id,
    });
    setFirstPerson(person);
    setStep(4);
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relativeName.trim() || !createdFamily || !firstPerson) {
      setStep(5);
      return;
    }

    const genLevel = relativeRelation === 'parent' ? 1 : relativeRelation === 'child' ? 3 : 2;

    const secondPerson = storage.addPerson({
      family_id: createdFamily.id,
      full_name: relativeName.trim(),
      display_name: relativeName.trim(),
      gender: 'unspecified',
      living_status: 'living',
      date_precision: 'estimated',
      generation_level: genLevel,
      created_by: currentUser.id,
    });

    if (relativeRelation === 'parent') {
      storage.addRelationship({
        family_id: createdFamily.id,
        source_person_id: secondPerson.id,
        target_person_id: firstPerson.id,
        relationship_type: 'parent',
        relationship_status: 'verified',
        created_by: currentUser.id,
      });
    } else if (relativeRelation === 'child') {
      storage.addRelationship({
        family_id: createdFamily.id,
        source_person_id: firstPerson.id,
        target_person_id: secondPerson.id,
        relationship_type: 'parent',
        relationship_status: 'verified',
        created_by: currentUser.id,
      });
    } else {
      storage.addRelationship({
        family_id: createdFamily.id,
        source_person_id: firstPerson.id,
        target_person_id: secondPerson.id,
        relationship_type: 'spouse',
        relationship_status: 'verified',
        created_by: currentUser.id,
      });
    }

    setStep(5);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !createdFamily) return;

    storage.addMembership({
      family_id: createdFamily.id,
      user_id: `usr_${Date.now()}`,
      user_email: inviteEmail.trim(),
      user_name: inviteEmail.split('@')[0],
      role: 'contributor',
      status: 'invited',
    });
    setInviteSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Step indicator progress bar */}
        <div className="w-full h-1.5 bg-stone-100">
          <div
            className="h-full bg-emerald-800 transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Step {step} of 6
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps */}
        <div className="p-8 text-xs">
          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                Welcome to Tiesora
              </h2>
              <p className="text-stone-600 max-w-md mx-auto leading-relaxed">
                Every relationship has a story. In just a couple of minutes, we’ll help you establish your family workspace, add your first relatives, and view your interactive family tree.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 mx-auto"
                >
                  Create Your Family ➔
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Create a family */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Name Your Family Tree</h3>
                <p className="text-stone-500 mt-0.5">What should this family collection be called?</p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Family Tree Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Harrison & Davis Heritage"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Optional Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Tracing our lineage from Virginia to Oregon..."
                  value={familyDescription}
                  onChange={(e) => setFamilyDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs"
                >
                  Continue ➔
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Add yourself or the first member */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add the First Family Member</h3>
                <p className="text-stone-500 mt-0.5">You can start with yourself or an elder relative.</p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thomas Montgomery"
                  value={selfName}
                  onChange={(e) => setSelfName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Birth Year (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1986"
                  value={selfBirthYear}
                  onChange={(e) => setSelfBirthYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs"
                >
                  Add First Relative ➔
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Add a relative */}
          {step === 4 && (
            <form onSubmit={handleStep4Submit} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add a Connecting Relative</h3>
                <p className="text-stone-500 mt-0.5">
                  Connect a parent, child, or spouse to {firstPerson?.display_name}.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Relative’s Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Robert Montgomery"
                  value={relativeName}
                  onChange={(e) => setRelativeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Relationship to {firstPerson?.display_name}
                </label>
                <select
                  value={relativeRelation}
                  onChange={(e) => setRelativeRelation(e.target.value as RelationshipType)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs bg-white"
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="spouse">Spouse / Partner</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-stone-500 hover:text-stone-800 underline"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs"
                >
                  Connect & Continue ➔
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: First Family Tree Preview */}
          {step === 5 && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <GitFork className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-stone-900">
                Your Tree is Ready!
              </h2>
              <p className="text-stone-600 max-w-sm mx-auto leading-relaxed">
                We’ve created your first interactive family branch. You can expand branches, add relatives, and calculate relationships anytime.
              </p>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-left space-y-2">
                <div className="flex items-center justify-between text-stone-800 font-semibold">
                  <span>{createdFamily?.name || familyName || 'Your Family Tree'}</span>
                  <span className="text-[11px] text-emerald-800">Ready</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  {firstPerson?.display_name} {relativeName ? `· Connected to ${relativeName}` : ''}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setStep(6)}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs"
                >
                  Invite Relatives (Optional) ➔
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Optional Invitation */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Invite a Relative to Collaborate</h3>
                <p className="text-stone-500 mt-0.5">Family history is best preserved together.</p>
              </div>

              {inviteSent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-700 mx-auto" />
                  <p className="font-bold text-emerald-950">Invitation Queued!</p>
                  <p className="text-stone-600">
                    We’ve generated access credentials for <strong>{inviteEmail}</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Relative’s Email
                    </label>
                    <input
                      type="email"
                      placeholder="relative@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-xl text-xs transition-colors"
                  >
                    Send Invitation
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end">
                <button
                  onClick={() => {
                    onComplete();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs"
                >
                  Enter Your Tree Workspace ➔
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
