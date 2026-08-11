export type AndroidSharedState = {
  language?: "fr" | "en" | "ar";
  theme?: "dark" | "light";
  riwayah?: "hafs" | "warsh";
  reciter?: string;
  tajweed?: boolean;
  pronunciation?: boolean;
  french?: boolean;
  english?: boolean;
  fontSize?: number;
  current?: number;
  currentVerse?: number;
  favorites?: number[];
  read?: number[];
  minutes?: number;
  goal?: number;
  onboarded?: boolean;
};

type AndroidBridge = {
  getState?: () => string;
  setState?: (value: string) => void;
  clearState?: () => void;
};

declare global {
  interface Window { NurAndroid?: AndroidBridge }
}

export function readAndroidState(): AndroidSharedState | null {
  try {
    const value=window.NurAndroid?.getState?.();
    return value ? JSON.parse(value) as AndroidSharedState : null;
  } catch { return null }
}

export function patchAndroidState(update: AndroidSharedState) {
  try {
    if(!window.NurAndroid?.setState)return;
    window.NurAndroid.setState(JSON.stringify({...readAndroidState(),...update}));
  } catch {}
}

export function clearAndroidState(){
  try{window.NurAndroid?.clearState?.()}catch{}
}

export function hydrateFromAndroid(){
  const state=readAndroidState();
  if(!state)return null;
  if(state.language)localStorage.setItem("nur-language",state.language);
  if(state.theme)localStorage.setItem("nur-theme",state.theme);
  if(state.onboarded)localStorage.setItem("nur-onboarding-complete","1");
  if(state.favorites)localStorage.setItem("nur-favorite-surahs",JSON.stringify(state.favorites));
  if(state.read)localStorage.setItem("nur-read-surahs",JSON.stringify(state.read));
  if(state.current)localStorage.setItem("nur-last-position",JSON.stringify({surah:state.current,verse:state.currentVerse||1}));
  const settings={
    riwayah:state.riwayah||"hafs",
    reciter:state.reciter||(state.riwayah==="warsh"?"hicham-lharraz":"ar.alafasy"),
    fontSize:state.fontSize||40,
    tajweed:!!state.tajweed,
    showFrench:state.french!==false,
    showEnglish:state.english!==false,
    showTransliteration:state.pronunciation!==false,
    playbackRate:1,
    repeatVerse:false,
  };
  localStorage.setItem("nur-settings",JSON.stringify({...settings,...safeJson(localStorage.getItem("nur-settings")),...settings}));
  localStorage.setItem("nur-progress",JSON.stringify({read:state.read?.length||0,minutes:state.minutes||0,goal:state.goal||10}));
  return state;
}

function safeJson(value:string|null){try{return value?JSON.parse(value):{}}catch{return{}}}
