import SmoothScroll from "@/components/layout/SmoothScroll";
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import About from "@/components/home/About";
import Experience from "@/components/home/Experience";
import Projects from "@/components/home/Projects";
import Skills from "@/components/home/Skills";
import Contact from "@/components/home/Contact";
import Footer from "@/components/layout/Footer";
import { profilePageJsonLd } from "@/lib/structuredData";
import JsonLd from "@/components/JsonLd";

export default function Home() {
  return (
    <>
      <JsonLd data={profilePageJsonLd} />
      <SmoothScroll />
      <div className="noise-overlay" aria-hidden />
      <Navbar />
      <main className="relative">
        <Hero />
        <div className="relative bg-ink">
          <div className="relative">
            <About />
            <Experience />
            <Projects />
            <Skills />
            <Contact />
            <Footer />
          </div>
        </div>
      </main>
    </>
  );
}
