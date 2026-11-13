/** Converts 1–26 to Roman numerals for generation labels. */
export function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = Math.max(1, Math.min(26, Math.floor(value || 1)));
  let result = '';

  for (const [amount, symbol] of numerals) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }

  return result;
}
