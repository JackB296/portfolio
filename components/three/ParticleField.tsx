"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { simplexNoise } from "./noise.glsl";
import { ACCENT } from "@/lib/theme";

/**
 * A drifting field of GPU-animated points. The vertex shader nudges each
 * particle along a flowing noise field so the whole cloud breathes.
 */
export default function ParticleField({ count = 1400 }: { count?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute in a spherical shell for depth
      const r = 4 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * 1.6 + 0.4;
    return arr;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(ACCENT) },
    }),
    []
  );

  const vertex = /* glsl */ `
    uniform float uTime;
    attribute float aSize;
    varying float vAlpha;
    ${simplexNoise}
    void main() {
      vec3 p = position;
      float n = snoise(p * 0.18 + vec3(uTime * 0.08));
      p += normalize(p) * n * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = aSize * (140.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
      vAlpha = 0.25 + 0.5 * smoothstep(-1.0, 1.0, n);
    }
  `;

  const fragment = /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float d = length(c);
      if (d > 0.5) discard;
      float glow = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(uColor, glow * vAlpha);
    }
  `;

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.03;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
