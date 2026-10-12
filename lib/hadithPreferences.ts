"use client";
import { useEffect, useState } from "react";
import { validHadithPreferences, type HadithPreferences } from "./hadithSettings";
export const HADITH_PREFERENCES_KEY = "nur-hadith-preferences";
export function useHadithPreferences(language: "fr"|"en"|"ar") {
  const [preferences,setPreferences]=useState<HadithPreferences>({languages:[language],fontSize:17});
  useEffect(()=>{
    const read=()=>{try{const p=JSON.parse(localStorage.getItem(HADITH_PREFERENCES_KEY)||"null");setPreferences(validHadithPreferences(p)?p:{languages:[language],fontSize:17});}catch{setPreferences({languages:[language],fontSize:17});}};
    read();
    for(const event of ["nur-hadith-preferences-changed","nur-data-changed","nur-cloud-hydrated","storage"])addEventListener(event,read);
    return()=>{for(const event of ["nur-hadith-preferences-changed","nur-data-changed","nur-cloud-hydrated","storage"])removeEventListener(event,read)};
  },[language]);
  const save=(p:HadithPreferences)=>{if(!validHadithPreferences(p))return;localStorage.setItem(HADITH_PREFERENCES_KEY,JSON.stringify(p));setPreferences(p);dispatchEvent(new Event("nur-hadith-preferences-changed"));dispatchEvent(new Event("nur-data-changed"));};
  return {preferences,save};
}
