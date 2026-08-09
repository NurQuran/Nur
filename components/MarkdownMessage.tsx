import { Fragment, type ReactNode } from "react";

function inline(text:string):ReactNode[]{
  const pattern=/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part,index)=>{
    if(part.startsWith("**")&&part.endsWith("**"))return <strong key={index}>{part.slice(2,-2)}</strong>;
    if(part.startsWith("__")&&part.endsWith("__"))return <strong key={index}>{part.slice(2,-2)}</strong>;
    if(part.startsWith("`")&&part.endsWith("`"))return <code key={index}>{part.slice(1,-1)}</code>;
    if((part.startsWith("*")&&part.endsWith("*"))||(part.startsWith("_")&&part.endsWith("_")))return <em key={index}>{part.slice(1,-1)}</em>;
    const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if(link)return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]} ↗</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function blockStart(line:string){return /^\s*(#{1,4}\s+|[-*•]\s+|\d+[.)]\s+|>\s+|---+$)/.test(line)}

export default function MarkdownMessage({content}:{content:string}){
  const lines=content.replace(/\r/g,"").split("\n"),blocks:ReactNode[]=[];
  let index=0,key=0;
  while(index<lines.length){
    const line=lines[index].trim();
    if(!line){index++;continue}
    const heading=line.match(/^(#{1,4})\s+(.+)$/);
    if(heading){const level=Math.min(4,heading[1].length+1),Tag=`h${level}` as "h2"|"h3"|"h4";blocks.push(<Tag key={key++}>{inline(heading[2])}</Tag>);index++;continue}
    if(/^[-*•]\s+/.test(line)){const items:ReactNode[]=[];while(index<lines.length&&/^\s*[-*•]\s+/.test(lines[index])){items.push(<li key={items.length}>{inline(lines[index].replace(/^\s*[-*•]\s+/,""))}</li>);index++}blocks.push(<ul key={key++}>{items}</ul>);continue}
    if(/^\d+[.)]\s+/.test(line)){const items:ReactNode[]=[];while(index<lines.length&&/^\s*\d+[.)]\s+/.test(lines[index])){items.push(<li key={items.length}>{inline(lines[index].replace(/^\s*\d+[.)]\s+/,""))}</li>);index++}blocks.push(<ol key={key++}>{items}</ol>);continue}
    if(/^>\s+/.test(line)){blocks.push(<blockquote key={key++}>{inline(line.replace(/^>\s+/,""))}</blockquote>);index++;continue}
    if(/^---+$/.test(line)){blocks.push(<hr key={key++}/>);index++;continue}
    const paragraph=[line];index++;while(index<lines.length&&lines[index].trim()&&!blockStart(lines[index])){paragraph.push(lines[index].trim());index++}blocks.push(<p key={key++}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="markdown-message">{blocks}</div>;
}
