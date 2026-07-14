"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import DistortedSphere from "./DistortedSphere";
import ParticleField from "./ParticleField";
import { GRADE_EVENT } from "@/lib/grades";
import {
  DEFAULT_THEME_PALETTE,
  getLiveThemePalette,
  type LiveThemePalette,
} from "@/lib/theme";

/** Eases the camera toward the pointer so the whole scene parallaxes. */
function CameraRig() {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(() => {
    camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.05;
    camera.position.y += (pointer.y * 1.0 - camera.position.y) * 0.05;
    camera.lookAt(target.current);
  });
  return null;
}

export default function HeroScene() {
  const [palette, setPalette] = useState<LiveThemePalette>(DEFAULT_THEME_PALETTE);

  // Film grades are CSS variables on <html>. Resample them after hydration and
  // whenever the theater previews, selects, or restores a grade.
  useEffect(() => {
    const syncPalette = () => setPalette(getLiveThemePalette());
    syncPalette();
    window.addEventListener(GRADE_EVENT, syncPalette);
    return () => window.removeEventListener(GRADE_EVENT, syncPalette);
  }, []);

  // When the visitor asks their OS for reduced motion, stop the continuous
  // render loop ("demand" only paints on mount/resize) so the sphere and
  // particles settle into a static frame instead of perpetually animating.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Insurance: nudge react-use-measure after mount so the canvas never starts
  // collapsed if the initial ResizeObserver callback is delayed.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event("resize"));
    const r = requestAnimationFrame(fire);
    const t = setTimeout(fire, 150);
    window.addEventListener("load", fire);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
      window.removeEventListener("load", fire);
    };
  }, []);

  return (
    <div
      data-testid="orbit-theme"
      data-orbit-accent={palette.accent}
      data-orbit-bright={palette.bright}
      data-orbit-dim={palette.dim}
      data-orbit-ink-soft={palette.inkSoft}
      className="h-full w-full"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ pointerEvents: "none" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} color={palette.dim} />
          <pointLight position={[5, 5, 5]} intensity={1.2} color={palette.bright} />
          <DistortedSphere palette={palette} />
          <ParticleField color={palette.accent} />
          <CameraRig />
        </Suspense>
      </Canvas>
    </div>
  );
}
