import {
  loadTreePreferences,
  saveHomePerson,
  saveLastFocusPerson,
} from './treePreferences';

interface TestResult {
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

export function runTreePreferencesTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];
  const original = globalThis.localStorage;
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
    writable: true,
  });

  try {
    saveHomePerson('family-a', 'user-1', 'person-1');
    saveLastFocusPerson('family-a', 'user-1', 'person-2');
    const loaded = loadTreePreferences('family-a', 'user-1');
    results.push({
      title: 'Home and last focus are stored per family and user',
      expected: 'person-1 / person-2',
      actual: `${loaded.homePersonId} / ${loaded.lastFocusPersonId}`,
      passed:
        loaded.homePersonId === 'person-1' &&
        loaded.lastFocusPersonId === 'person-2',
    });

    saveHomePerson('family-a', 'user-2', 'person-3');
    const secondUser = loadTreePreferences('family-a', 'user-2');
    results.push({
      title: 'Home person is isolated per user',
      expected: 'person-3',
      actual: String(secondUser.homePersonId),
      passed: secondUser.homePersonId === 'person-3',
    });

    saveHomePerson('family-b', 'user-1', 'person-4');
    const secondFamily = loadTreePreferences('family-b', 'user-1');
    results.push({
      title: 'Home person is isolated per family',
      expected: 'person-4',
      actual: String(secondFamily.homePersonId),
      passed: secondFamily.homePersonId === 'person-4',
    });

    saveHomePerson('family-clear', 'user-clear', 'person-5');
    saveHomePerson('family-clear', 'user-clear', null);
    const cleared = loadTreePreferences('family-clear', 'user-clear');
    results.push({
      title: 'Setting home to null clears the preference',
      expected: 'null',
      actual: String(cleared.homePersonId),
      passed: cleared.homePersonId === null,
    });

    saveLastFocusPerson('family-a', 'user-1', null);
    const clearedFocus = loadTreePreferences('family-a', 'user-1');
    results.push({
      title: 'Clearing last focus leaves the home preference intact',
      expected: 'person-1 / null',
      actual: `${clearedFocus.homePersonId} / ${clearedFocus.lastFocusPersonId}`,
      passed:
        clearedFocus.homePersonId === 'person-1' &&
        clearedFocus.lastFocusPersonId === null,
    });
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      configurable: true,
      writable: true,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
