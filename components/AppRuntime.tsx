"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "../lib/i18n";
import { motionReduced, scrollMotion } from "../lib/motion";
import { captureRouteFrame, playRouteFrame } from "../lib/routeMotion";
import { recordVisit } from "../lib/analytics";
import { haptic } from "../lib/haptics";

export default function AppRuntime(){
  const {language}=useLanguage();
  const pathname=usePathname(),router=useRouter();
  const outgoingFrame=useRef<HTMLElement|null>(null);
  useEffect(()=>()=>{outgoingFrame.current?.remove()},[]);
  const [offline,setOffline]=useState(false);
  const [reconnected,setReconnected]=useState(false);
  useLayoutEffect(()=>{
    playRouteFrame(outgoingFrame.current);outgoingFrame.current=null;
    document.body.classList.remove("nur-client-navigation","nur-route-leave-left","nur-route-leave-right");
    document.documentElement.classList.remove("nur-native-android");
    document.documentElement.classList.toggle("nur-android-runtime",!!window.NurAndroid);
    const routeOrder:Record<string,number>={"/":0,"/home":0,"/welcome":0,"/read":1,"/assistant":2,"/favorites":3};
    if(pathname!=="/read"&&pathname!=="/admin")recordVisit();
    // Router state commits before the address bar in some client navigations.
    const route=routeOrder[pathname]??0;
    let previous=route;
    try{previous=Number(sessionStorage.getItem("nur-route-index"))}catch{}
    const direction=Number.isFinite(previous)&&previous!==route?(route>previous?"forward":"back"):"initial";
    const routeClass=`nur-route-${direction}`;
    document.body.classList.add(routeClass);
    try{sessionStorage.setItem("nur-route-index",String(route))}catch{}
    const routeTimer=setTimeout(()=>document.body.classList.remove(routeClass),900);
    const query=new URLSearchParams(location.search);
    if(query.get("reconnected")==="1"){
      setReconnected(true);
      query.delete("reconnected");
      history.replaceState({},"",`${location.pathname}${query.size?`?${query}`:""}${location.hash}`);
      setTimeout(()=>setReconnected(false),4600);
    }
    const update=()=>{const unavailable=!navigator.onLine;setOffline(unavailable);if(unavailable&&window.NurAndroid?.openOffline)setTimeout(()=>window.NurAndroid?.openOffline?.(),450)};update();
    addEventListener("online",update);addEventListener("offline",update);
    let navigating:string|null=null;
    let navigationTimer:ReturnType<typeof setTimeout>|undefined;
    const leave=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=(event.target as HTMLElement)?.closest<HTMLAnchorElement>("a[href]");
      if(!anchor||anchor.target||anchor.hasAttribute("download"))return;
      const destination=new URL(anchor.href,location.href);
      if(destination.origin!==location.origin)return;
      if(destination.pathname===pathname){
        if(anchor.matches(".topbar nav a.active")){
          event.preventDefault();event.stopPropagation();
          if(destination.pathname==="/read")dispatchEvent(new Event("nur-reader-reselect"));
          else if(destination.pathname==="/favorites")dispatchEvent(new Event("nur-hadith-reselect"));
          else scrollTo({top:0,behavior:scrollMotion()});
        }
        return;
      }
      const next=routeOrder[destination.pathname];if(next===undefined)return;
      // Authentication must still cross the server boundary; app tabs keep their layout/session.
      if(destination.pathname==="/welcome"||pathname==="/welcome")return;
      // Keep link handlers alive (e.g. attaching a hadith before entering Fqih).
      event.preventDefault();
      if(navigating===destination.href)return;
      navigating=destination.href;
      clearTimeout(navigationTimer);
      document.body.classList.remove("nur-route-leave-left","nur-route-leave-right");
      outgoingFrame.current?.remove();
      if(!motionReduced())outgoingFrame.current=captureRouteFrame(next>route?"left":"right");
      // React keeps the previous page mounted while the next route is fetched.
      router.push(destination.pathname+destination.search+destination.hash);
      navigationTimer=setTimeout(()=>{navigating=null;outgoingFrame.current?.remove();outgoingFrame.current=null},10000);
    };
    document.addEventListener("click",leave,true);
    const press=(event:PointerEvent)=>{if(event.pointerType==="mouse"&&!window.NurAndroid)return;const control=(event.target as HTMLElement)?.closest<HTMLElement>("button,a[href],select,input[type=checkbox],input[type=range]");if(!control||control.hasAttribute("disabled"))return;const warning=control.matches(".danger,.reset-data-button,.offline-clear");const medium=control.matches(".primary,.play-surah,.main-play,.mark-read-button,.download-surah-audio");haptic(warning?"warning":medium?"medium":"selection")};
    document.addEventListener("pointerdown",press,true);
    return()=>{clearTimeout(routeTimer);clearTimeout(navigationTimer);document.body.classList.remove(routeClass,"nur-client-navigation","nur-route-leave-left","nur-route-leave-right");removeEventListener("online",update);removeEventListener("offline",update);document.removeEventListener("click",leave,true);document.removeEventListener("pointerdown",press,true)};
  },[pathname,router]);
  if(!offline&&!reconnected)return null;
  return <div className={`global-offline-notice${reconnected&&!offline?" is-online":""}`} role="status"><span aria-hidden="true"/><strong>{offline?(language==="ar"?"أنت غير متصل بالإنترنت":language==="en"?"You are offline":"Vous êtes hors ligne"):(language==="ar"?"عاد الاتصال بالإنترنت":language==="en"?"You are back online":"Vous êtes de nouveau en ligne")}</strong><small>{offline?(language==="ar"?"تم تشغيل نسخة القراءة دون اتصال.":language==="en"?"The offline reading version is active.":"La version de lecture hors ligne est active."):(language==="ar"?"تمت استعادة صفحتك وموضع قراءتك.":language==="en"?"Your page and reading position have been restored.":"Votre page et votre position de lecture ont été restaurées.")}</small></div>;
}
