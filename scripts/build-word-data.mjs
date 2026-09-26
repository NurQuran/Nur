// Source: Hablullah/data-quran, CC BY-NC-ND 4.0. Keep source text/glosses unchanged.
// https://github.com/mamun-al-abdullah/quran
import { writeFile } from "node:fs/promises";

const root = "https://raw.githubusercontent.com/mamun-al-abdullah/quran/master/";
const files = ["word/word.json", "word-text/uthmani-qurancom.json", "word-transliteration/en-qurancom.json", "word-translation/en-qurancom.json"];
const data = await Promise.all(files.map(async path => {
  const response = await fetch(root + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}));
const [positions, arabic, pronunciation, english] = data;
const grouped = {};
let count = 0;
for (const [id, position] of Object.entries(positions)) {
  if (!arabic[id] || !pronunciation[id] || !english[id]) continue;
  const chapter = grouped[position.surah] ||= {};
  const verse = chapter[position.ayah] ||= [];
  verse[position.position] = [arabic[id], pronunciation[id], english[id]];
  count++;
}
if (count < 77000 || Object.keys(grouped).length !== 114) throw new Error(`Incomplete word data: ${count}`);
const output = `/* Hablullah/data-quran · CC BY-NC-ND 4.0 · https://github.com/mamun-al-abdullah/quran */\nwindow.NUR_WORD_DATA=${JSON.stringify(grouped)};\n`;
await Promise.all(process.argv.slice(2).map(path => writeFile(path, output, "utf8")));
console.log(`Bundled ${count} attributed words across 114 surahs`);
