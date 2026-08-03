export type QuranVerse = { number: number; arabic: string; tajweedHtml?: string; transliteration: string; fr: string; en: string; audioUrl?: string; juz?: number; page?: number; hizbQuarter?: number };
export type QuranSurah = { number: number; nameArabic: string; nameLatin: string; revelationType: string; verses: QuranVerse[]; sourceLabel: string };
export type ReaderOptions = { riwayah: "hafs" | "warsh"; reciter: string; fontSize: number; tajweed: boolean; showFrench: boolean; showEnglish: boolean; showTransliteration: boolean; playbackRate: number; repeatVerse: boolean };
export interface QuranDataSource { getSurah(number: number, options: ReaderOptions): Promise<QuranSurah>; }
