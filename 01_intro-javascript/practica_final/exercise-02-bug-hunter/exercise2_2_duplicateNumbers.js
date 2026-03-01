function duplicateNumbers(numbers) {
  const duplicatedNumbers = [];

  for (let i = 0; i < numbers.length; i++) {
    duplicatedNumbers.push(numbers[i] * 2);
  }

  return duplicatedNumbers;
}

// Bonus with map
function duplicateNumbersWithMap(numbers) {
  return numbers.map((number) => number * 2);
}

const original = [1, 2, 3, 4, 5];
const duplicated = duplicateNumbers(original);

console.log("Original:", original);
console.log("Duplicated (for):", duplicated);
console.log("Duplicated (map):", duplicateNumbersWithMap(original));

