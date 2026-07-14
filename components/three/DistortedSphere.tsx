"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { simplexNoise } from "./noise.glsl";
import { ACCENT, ACCENT_BRIGHT } from "@/lib/theme";

/**
 * A wobbling icosahedron driven by a custom GLSL shader.
 * Vertex shader displaces along the normal using flowing simplex noise;
 * fragment shader paints a fresnel-lit accent gradient.
 */
export default function DistortedSphere() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistort: { value: 0.42 },
      uColorA: { value: new THREE.Color(ACCENT) },
      uColorB: { value: new THREE.Color("#1b1f3a") },
      uAccent: { value: new THREE.Color(ACCENT_BRIGHT) },
    }),
    []
  );

  const vertex = /* glsl */ `
    uniform float uTime;
    uniform float uDistort;
    varying vec3 vNormal;
    varying float vDisp;
    ${simplexNoise}
    void main() {
      vNormal = normal;
      float n = snoise(position * 1.1 + vec3(uTime * 0.25));
      n += 0.5 * snoise(position * 2.3 - vec3(uTime * 0.18));
      vDisp = n;
      vec3 displaced = position + normal * n * uDistort;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  const fragment = /* glsl */ `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uAccent;
    varying vec3 vNormal;
    varying float vDisp;
    void main() {
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 2.0);
      vec3 base = mix(uColorB, uColorA, smoothstep(-1.0, 1.0, vDisp));
      vec3 col = mix(base, uAccent, fresnel * 0.9);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.12;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} scale={1.35}>
      <icosahedronGeometry args={[1, 48]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        wireframe
      />
    </mesh>
  );
}
