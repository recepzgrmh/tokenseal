// A deliberately broken helper for the TokenSeal demo.
// Bug: throws on an empty array instead of returning 0.
export function sum(numbers) {
  return numbers.reduce((total, n) => total + n);
}
