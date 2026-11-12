import React, { useState } from 'react';
import { Family, FamilyEvent, FamilyPerson, UserProfile } from '../../types';
import { createEventAction } from '../../services/dataActions';
import { 
  Calendar, 
  MapPin, 
  Plus, 
  Cake, 
  Heart, 
  Users, 
  Sparkles, 
  X, 
  AlertCircle 
} from 'lucide-react';

interface EventsPageProps {
  family: Family;
  currentUser: UserProfile;
  canEdit: boolean;
  events: FamilyEvent[];
  people: FamilyPerson[];
  onSelectPerson: (person: FamilyPerson) => void;
  onRefreshEvents: () => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  family,
  currentUser,
  canEdit,
  events,
  people,
  onSelectPerson,
  onRefreshEvents,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<FamilyEvent['event_type']>('reunion');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [associatedPersonIds, setAssociatedPersonIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const peopleMap = new Map<string, FamilyPerson>(people.map(p => [p.id, p]));

  // Auto-generate upcoming birthdays from people records
  const upcomingBirthdays = people
    .filter(p => p.living_status === 'living' && p.birth_date)
    .map(p => {
      const birthMonthDay = p.birth_date!.substring(5); // MM-DD
      return {
        id: `bday_${p.id}`,
        family_id: p.family_id,
        title: `${p.display_name}’s Birthday`,
        event_type: 'birthday' as const,
        event_date: `2027-${birthMonthDay}`,
        location: p.birth_place || 'Family Gathering',
        description: `Celebrating ${p.display_name} (Generation ${p.generation_level}).`,
        associated_person_ids: [p.id],
        created_by: 'system',
        created_at: new Date().toISOString(),
      };
    })
    .slice(0, 4);

  // Combine custom events + birthdays
  const allEvents = [...events, ...upcomingBirthdays].sort((a, b) =>
    a.event_date.localeCompare(b.event_date)
  );

  const toggleAssociatePerson = (id: string) => {
    setAssociatedPersonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !eventDate) {
      setError('Title and date are required.');
      return;
    }

    setSaving(true);

    try {
      await createEventAction(
        {
          family_id: family.id,
          title: title.trim(),
          event_type: eventType,
          event_date: eventDate,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          associated_person_ids: associatedPersonIds,
        },
        currentUser,
      );

      onRefreshEvents();
      setIsAddOpen(false);
      setTitle('');
      setEventDate('');
      setLocation('');
      setDescription('');
      setAssociatedPersonIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EventsPage] create event failed:', err);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            Family Milestones & Calendar
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Events & Anniversaries
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Never miss a birthday, wedding anniversary, or upcoming family reunion.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Schedule Event
          </button>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allEvents.map(evt => {
          const isBirthday = evt.event_type === 'birthday';
          const isAnniversary = evt.event_type === 'anniversary';
          const isReunion = evt.event_type === 'reunion';

          const icon = isBirthday ? (
            <Cake className="w-4 h-4 text-rose-600" />
          ) : isAnniversary ? (
            <Heart className="w-4 h-4 text-amber-600" />
          ) : (
            <Users className="w-4 h-4 text-emerald-700" />
          );

          const borderColor = isBirthday
            ? 'border-rose-200 bg-rose-50/20'
            : isAnniversary
            ? 'border-amber-200 bg-amber-50/20'
            : 'border-emerald-200 bg-emerald-50/20';

          return (
            <div
              key={evt.id}
              className={`p-5 rounded-2xl border ${borderColor} bg-white shadow-2xs hover:shadow-xs transition-all space-y-3`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-stone-100">
                    {icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">{evt.title}</h3>
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider capitalize">
                      {evt.event_type}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-stone-800 tabular-nums">
                    {evt.event_date}
                  </span>
                </div>
              </div>

              {evt.description && (
                <p className="text-xs text-stone-600 leading-relaxed">
                  {evt.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
                {evt.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    {evt.location}
                  </span>
                ) : <span />}

                {evt.associated_person_ids.length > 0 && (
                  <div className="flex items-center gap-1">
                    {evt.associated_person_ids.map(id => {
                      const person = peopleMap.get(id);
                      if (!person) return null;
                      return (
                        <button
                          key={person.id}
                          onClick={() => onSelectPerson(person)}
                          className="hover:underline text-[11px] text-stone-700 font-medium"
                        >
                          {person.display_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Event Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/70">
              <h3 className="text-base font-bold text-stone-900">Schedule Family Event</h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2027 Summer Family Gathering"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                  >
                    <option value="reunion">Family Reunion</option>
                    <option value="birthday">Birthday</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="gathering">Gathering / Dinner</option>
                    <option value="memorial">Memorial Service</option>
                    <option value="other">Other Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Lake Sunapee Grounds, NH"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Notes & Description</label>
                <textarea
                  rows={2}
                  placeholder="Details, schedule, or lodging notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Tag Associated Relatives ({associatedPersonIds.length})
                </label>
                <div className="max-h-28 overflow-y-auto border border-stone-200 rounded-xl p-2 grid grid-cols-2 gap-1.5 bg-stone-50">
                  {people.map(p => {
                    const isTagged = associatedPersonIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleAssociatePerson(p.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors ${
                          isTagged
                            ? 'bg-emerald-800 text-white font-semibold'
                            : 'bg-white hover:bg-stone-200 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {p.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs"
                >
                  {saving ? 'Saving…' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
