import React from 'react';
import type { FamilyPerson } from '../../types';
import { FamilyImage } from './FamilyImage';

interface MemberAvatarProps {
  person: Pick<FamilyPerson, 'display_name' | 'avatar_path' | 'gender'>;
  /** Tailwind size/text classes, e.g. "w-8 h-8 text-xs". */
  className?: string;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  person,
  className = 'w-8 h-8 text-xs',
}) => {
  const initials = person.display_name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  if (person.avatar_path) {
    return (
      <FamilyImage
        src={person.avatar_path}
        alt={person.display_name}
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover border border-stone-200 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 border ${
        person.gender === 'female'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : person.gender === 'male'
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
          : 'bg-stone-100 text-stone-700 border-stone-200'
      } ${className}`}
    >
      {initials || '?'}
    </div>
  );
};
