type IconName = "play" | "pause" | "sun" | "moon" | "sparkle";

export default function UiIcon({name,className=""}:{name:IconName;className?:string}){
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name==="play"&&<path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>}
    {name==="pause"&&<><rect x="6" y="4.5" width="4" height="15" rx="1.3" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.3" fill="currentColor" stroke="none"/></>}
    {name==="sun"&&<><circle cx="12" cy="12" r="4.1"/><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.49 1.49m11.16 11.16 1.49 1.49M2 12h2.1M19.9 12H22M4.93 19.07l1.49-1.49M17.58 6.42l1.49-1.49"/></>}
    {name==="moon"&&<path d="M20.1 15.9A8.5 8.5 0 0 1 8.1 3.9 8.55 8.55 0 1 0 20.1 15.9Z"/>}
    {name==="sparkle"&&<><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .6 1.4L21 18l-1.4.6L19 20l-.6-1.4L17 18l1.4-.6L19 16Z"/></>}
  </svg>;
}
