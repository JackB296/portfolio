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
          {/* subtle grid backdrop for content sections */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--accent-rgb)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--accent-rgb)/0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_85%)]" />
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
