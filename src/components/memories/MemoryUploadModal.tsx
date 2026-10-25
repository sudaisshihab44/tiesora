import React, { useState, useRef, useCallback } from 'react';
import { FamilyPerson, Memory } from '../../types';
import { storage } from '../../services/storage';
import { X, Upload, Calendar, MapPin, Tag, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';

interface MemoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: FamilyPerson[];
  onMemoryAdded: (memory: Memory) => void;
}

export const MemoryUploadModal: React.FC<MemoryUploadModalProps> = ({
  isOpen,
  onClose,
  people,
  onMemoryAdded,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [album, setAlbum] = useState('Family Archives');
  const [taggedPersonIds, setTaggedPersonIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleTagPerson = (id: string) => {
    setTaggedPersonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const samplePhotoPresets = [
    { label: 'Family Cabin', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Vintage Garden', url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Coastline Sailing', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Celebration', url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=80' },
  ];

  // Read a File as a base64 data URL (works with localStorage / no backend needed)
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP, etc.).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB. For larger photos, use a URL instead.');
      return;
    }
    setUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
      setUploading(false);
    };
    reader.onerror = () => {
      setError('Failed to read the selected file.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a title for the memory.');
      return;
    }

    if (!imageUrl.trim()) {
      setError('Please upload a photo or provide a photograph URL.');
      return;
    }

    const family = storage.getCurrentFamily();
    const currentUser = storage.getCurrentUser();

    const newMem = storage.addMemory({
      family_id: family.id,
      title: title.trim(),
      description: description.trim() || undefined,
      memory_date: memoryDate || undefined,
      location: location.trim() || undefined,
      image_url: imageUrl.trim(),
      tagged_person_ids: taggedPersonIds,
      album: album.trim() || 'Family Archives',
      is_private: isPrivate,
      created_by: currentUser.id,
      created_by_name: currentUser.display_name,
    });

    onMemoryAdded(newMem);
    // Reset form
    setTitle(''); setDescription(''); setMemoryDate(''); setLocation('');
    setImageUrl(''); setAlbum('Family Archives'); setTaggedPersonIds([]); setIsPrivate(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl max-w-xl w-full overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150 max-h-[90vh] sm:max-h-none flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/70 shrink-0">
          <div>
            <h3 className="text-base font-bold text-stone-900">Upload Family Memory</h3>
            <p className="text-xs text-stone-500 mt-0.5">Preserve photographs, milestones, and stories</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1975 Lake Sunapee Cabin Build"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-sm"
            />
          </div>

          {/* File Upload Zone */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Photograph <span className="text-rose-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-stone-300 hover:border-emerald-600/60 rounded-xl p-4 text-center bg-stone-50/50 transition-colors cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                  <span className="text-stone-600">Processing image…</span>
                </div>
              ) : imageUrl ? (
                <div className="space-y-2">
                  <img src={imageUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-32 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImageUrl(''); }}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  <Upload className="w-6 h-6 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-700">Click to upload or drag & drop</p>
                  <p className="text-[11px] text-stone-400">JPG, PNG, WebP — max 4MB</p>
                </div>
              )}
            </div>
          </div>

          {/* URL alternative */}
          {!imageUrl && (
            <div>
              <label className="block font-medium text-stone-500 mb-1">Or use a URL:</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-xs"
              />
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-stone-400 text-[11px]">Sample:</span>
                {samplePhotoPresets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className="px-2 py-0.5 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 rounded text-[10px] text-stone-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Date</label>
              <input
                type="date"
                value={memoryDate}
                onChange={(e) => setMemoryDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Lake Sunapee, NH"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-xs"
              />
            </div>
          </div>

          {/* Album */}
          <div>
            <label className="block font-medium text-stone-700 mb-1">Album Name</label>
            <input
              type="text"
              placeholder="e.g. Summer Vacations, Weddings"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-xs"
            />
          </div>

          {/* Tag People */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Tagged Family Members ({taggedPersonIds.length})
            </label>
            <div className="max-h-28 overflow-y-auto border border-stone-200 rounded-xl p-2 grid grid-cols-2 gap-1.5 bg-stone-50">
              {people.map(p => {
                const isTagged = taggedPersonIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleTagPerson(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between text-xs transition-colors ${
                      isTagged
                        ? 'bg-emerald-800 text-white font-semibold'
                        : 'bg-white hover:bg-stone-200/70 text-stone-700 border border-stone-200'
                    }`}
                  >
                    <span className="truncate">{p.display_name}</span>
                    <span className="text-[10px] opacity-75 shrink-0">Gen {p.generation_level}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Story & Captions</label>
            <textarea
              rows={2}
              placeholder="What happened on this day? Who was there?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-xs resize-none"
            />
          </div>

          {/* Private toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded text-emerald-800 focus:ring-emerald-700"
            />
            <label htmlFor="isPrivate" className="text-stone-700">
              Mark as private (only visible to you and admins)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl font-medium">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs">
              Save Memory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
