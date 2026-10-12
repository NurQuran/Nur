"use client";
import { useEffect, useRef } from "react";
import { haptic } from "./haptics";
// Ordinary flat list scrolling, retaining optional item-by-item haptics.
export function useReadingWheel(dependency: unknown) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const root=ref.current;if(!root)return;
    let frame=0, userScrollUntil=0, lastPulse=0;
    let centered:HTMLElement|null=null, scrolled=false;
    const paint=()=>{frame=0;const center=root.scrollTop+root.clientHeight/2;
      let nearest:HTMLElement|null=null, nearestDistance=Infinity;
      for(const item of root.querySelectorAll<HTMLElement>(":scope > button, :scope > a")){
        const pixels=Math.abs(item.offsetTop+item.offsetHeight/2-center);
        if(pixels<nearestDistance){nearestDistance=pixels;nearest=item}
      }
      const now=performance.now();
      if(scrolled&&centered&&nearest!==centered&&now<userScrollUntil&&now-lastPulse>=45){haptic("selection");lastPulse=now}
      centered=nearest;scrolled=false;
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint)};
    const interact=()=>{userScrollUntil=performance.now()+2500};
    const onScroll=()=>{scrolled=true;schedule()};
    const resize=new ResizeObserver(schedule);resize.observe(root);
    root.addEventListener("scroll",onScroll,{passive:true});
    root.addEventListener("pointerdown",interact,{passive:true});
    root.addEventListener("touchmove",interact,{passive:true});
    root.addEventListener("wheel",interact,{passive:true});
    root.addEventListener("keydown",interact);schedule();
    return()=>{root.removeEventListener("scroll",onScroll);root.removeEventListener("pointerdown",interact);root.removeEventListener("touchmove",interact);root.removeEventListener("wheel",interact);root.removeEventListener("keydown",interact);resize.disconnect();if(frame)cancelAnimationFrame(frame)};
  },[dependency]);
  return ref;
}
