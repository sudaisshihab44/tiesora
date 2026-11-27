const PREFIX = 'tiesora.tree';

export interface TreePreferences {
  homePersonId: string | null;
  lastFocusPersonId: string | null;
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function key(familyId: string, userId: string, kind: 'home' | 'last-focus'): string {
  return `${PREFIX}.${familyId}.${userId}.${kind}`;
}

function read(keyName: string): string | null {
  try {
    return storage()?.getItem(keyName) ?? null;
  } catch {
    return null;
  }
}

function write(keyName: string, value: string | null) {
  try {
    const store = storage();
    if (!store) return;
    if (value) {
      store.setItem(keyName, value);
    } else {
      store.removeItem(keyName);
    }
  } catch {
    // Private mode or storage denial must never block the tree.
  }
}

export function loadTreePreferences(
  familyId: string,
  userId: string,
): TreePreferences {
  return {
    homePersonId: read(key(familyId, userId, 'home')),
    lastFocusPersonId: read(key(familyId, userId, 'last-focus')),
  };
}

export function saveHomePerson(
  familyId: string,
  userId: string,
  personId: string | null,
) {
  write(key(familyId, userId, 'home'), personId);
}

export function saveLastFocusPerson(
  familyId: string,
  userId: string,
  personId: string | null,
) {
  write(key(familyId, userId, 'last-focus'), personId);
}
