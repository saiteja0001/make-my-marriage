export function suggestNameCapitalization(name: string) {
  return name.trim().replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => {
    return separator + letter.toUpperCase();
  });
}

export function suggestDescriptionCapitalization(description: string) {
  return description.trim().replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
