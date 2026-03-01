function countVowels(text) {
  const vowels = ["a", "e", "i", "o", "u"];
  let counter = 0;
  const lowerText = text.toLowerCase();

  for (let i = 0; i < lowerText.length; i++) {
    if (vowels.includes(lowerText[i])) {
      counter++;
    }
  }

  return counter;
}

const testPhrases = [
  "Antes no programaba. Ahora si!",
  "JAVASCRIPT",
  "hola mundo",
  "rhythms",
  "A E I O U a e i o u"
];

for (let i = 0; i < testPhrases.length; i++) {
  const phrase = testPhrases[i];
  const result = countVowels(phrase);
  console.log(`"${phrase}" -> ${result} vocales`);
}
