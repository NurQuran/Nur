import type { QuranSurah } from "./types";

// DEMO ONLY. A small, explicitly labeled offline sample. Production content is loaded by the adapter.
export const demoSurahs: Record<number, QuranSurah> = {
  1: { number: 1, nameArabic: "الفاتحة", nameLatin: "Al-Fātiḥah", revelationType: "Mecquoise", sourceLabel: "Échantillon hors ligne — AlQuran Cloud / Hamidullah / Asad", verses: [
    { number: 1, arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", transliteration: "Bismi-llāhi r-raḥmāni r-raḥīm", fr: "Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux.", en: "In the name of God, The Most Gracious, The Dispenser of Grace.", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3" },
    { number: 2, arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", transliteration: "Al-ḥamdu li-llāhi rabbi l-ʿālamīn", fr: "Louange à Allah, Seigneur de l’univers.", en: "All praise is due to God alone, the Sustainer of all the worlds.", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/2.mp3" },
    { number: 3, arabic: "الرَّحْمَٰنِ الرَّحِيمِ", transliteration: "Ar-raḥmāni r-raḥīm", fr: "Le Tout Miséricordieux, le Très Miséricordieux.", en: "The Most Gracious, the Dispenser of Grace.", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/3.mp3" },
    { number: 4, arabic: "مَالِكِ يَوْمِ الدِّينِ", transliteration: "Māliki yawmi d-dīn", fr: "Maître du Jour de la rétribution.", en: "Lord of the Day of Judgment!", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/4.mp3" },
    { number: 5, arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", transliteration: "Iyyāka naʿbudu wa iyyāka nastaʿīn", fr: "C’est Toi [Seul] que nous adorons, et c’est Toi [Seul] dont nous implorons secours.", en: "Thee alone do we worship; and unto Thee alone do we turn for aid.", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/5.mp3" },
    { number: 6, arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", transliteration: "Ihdinā ṣ-ṣirāṭa l-mustaqīm", fr: "Guide-nous dans le droit chemin,", en: "Guide us the straight way—", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/6.mp3" },
    { number: 7, arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ", transliteration: "Ṣirāṭa lladhīna anʿamta ʿalayhim ghayri l-maghḍūbi ʿalayhim wa lā ḍ-ḍāllīn", fr: "le chemin de ceux que Tu as comblés de faveurs, non pas de ceux qui ont encouru Ta colère, ni des égarés.", en: "the way of those upon whom Thou hast bestowed Thy blessings, not of those who have been condemned, nor of those who go astray!", audioUrl: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/7.mp3" }
  ].slice(1).map((verse,index)=>({...verse,number:index+1})) }
};
