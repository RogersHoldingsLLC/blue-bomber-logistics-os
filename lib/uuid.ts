export function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomValues =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(16))
      : fallbackRandomValues();

  randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
  randomValues[8] = (randomValues[8] & 0x3f) | 0x80;

  const hexValues = Array.from(randomValues, (value) => value.toString(16).padStart(2, "0"));

  return [
    hexValues.slice(0, 4).join(""),
    hexValues.slice(4, 6).join(""),
    hexValues.slice(6, 8).join(""),
    hexValues.slice(8, 10).join(""),
    hexValues.slice(10, 16).join("")
  ].join("-");
}

function fallbackRandomValues() {
  const timestamp = Date.now();
  const randomValues = new Uint8Array(16);

  for (let index = 0; index < randomValues.length; index += 1) {
    const timeByte = (timestamp >> ((index % 6) * 8)) & 0xff;
    randomValues[index] = Math.floor(Math.random() * 256) ^ timeByte;
  }

  return randomValues;
}
