"use client";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import HadithLibrary from "../../components/HadithLibrary";
export default function HadithPage() {
  return <main className="hadith-page"><SiteHeader active="favorites"/><HadithLibrary/><SiteFooter/></main>;
}
