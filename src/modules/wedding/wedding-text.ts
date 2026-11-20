export function capitalizeFirstLetter(value: string) {
  return value.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
