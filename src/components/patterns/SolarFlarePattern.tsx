import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface SolarFlarePatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

interface SolarSystemProps {
  audioData: AudioAnalysisData;
  config: VisualizationConfig;
  dimensions: { width: number; height: number };
}

const SolarSystem: React.FC<SolarSystemProps> = ({ audioData, config, dimensions }) => {
  const { bassEnergy, midEnergy, highEnergy, beat, frequencyData } = audioData;
  const { camera } = useThree();
  const earthRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const solarFlaresRef = useRef<THREE.Points[]>([]);
  const time = useRef(0);
  const beatAnimationRef = useRef(0);
  const earthSize = useRef(8); // Base earth size
  const maxParticlesRef = useRef(1000);

  // Track screen size for guaranteed responsive adjustments
  const isSmallScreen = dimensions.width < 768;
  const isTinyScreen = dimensions.width < 600;

  // Configure camera based on screen size
  useEffect(() => {
    if ('fov' in camera) {
      // Adjust FOV for different screen sizes
      if (isTinyScreen) {
        camera.fov = 70; // Widest view for very small screens
      } else if (isSmallScreen) {
        camera.fov = 50; // Wide view for small screens
      } else {
        camera.fov = 42; // Normal view for larger screens
      }
      camera.updateProjectionMatrix();
    }

    // Set camera to fixed distance that ensures all particles are visible
    const distance = isTinyScreen ? 100 : (isSmallScreen ? 90 : 80);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    // Apply earth tilt
    if (earthRef.current && atmosphereRef.current) {
      const tiltAngle = (23.5 * Math.PI) / 180;
      earthRef.current.rotation.z = tiltAngle;
      atmosphereRef.current.rotation.z = tiltAngle;
    }
  }, [camera, isSmallScreen, isTinyScreen]);

  // Load earth texture and initialize flares
  useEffect(() => {
    if (!earthRef.current || !atmosphereRef.current) return;

    // Load earth texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/earth_atmos_2048.jpg', (texture) => {
      const material = earthRef.current?.material as THREE.MeshStandardMaterial;
      if (material) {
        material.map = texture;
        material.needsUpdate = true;
      }
    });

    // Initialize flares
    const flareCount = isSmallScreen ? 8 : 12; // Fewer flares on small screens for better performance
    solarFlaresRef.current = [];

    for (let i = 0; i < flareCount; i++) {
      const positions = new Float32Array(maxParticlesRef.current * 3);
      const colors = new Float32Array(maxParticlesRef.current * 3);
      const velocities = new Float32Array(maxParticlesRef.current * 3);
      const sizes = new Float32Array(maxParticlesRef.current);

      // Initialize particles offscreen
      for (let j = 0; j < maxParticlesRef.current; j++) {
        positions[j * 3] = 1000;
        positions[j * 3 + 1] = 1000;
        positions[j * 3 + 2] = 0;

        velocities[j * 3] = 0;
        velocities[j * 3 + 1] = 0;
        velocities[j * 3 + 2] = 0;

        colors[j * 3] = 1;
        colors[j * 3 + 1] = 0.5;
        colors[j * 3 + 2] = 0.2;

        sizes[j] = 0.3;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      // Create larger particles on smaller screens
      const particleSize = isSmallScreen ? 0.6 : 0.3;

      const material = new THREE.PointsMaterial({
        size: particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      const flare = new THREE.Points(geometry, material);
      solarFlaresRef.current.push(flare);
    }
  }, [isSmallScreen]);

  // Animation frame
  useFrame(() => {
    time.current += 0.016;
    const enhancedSensitivity = config.sensitivity * 1.2;
    const enhancedMotion = config.motionIntensity * 1.5;
    const totalEnergy = (bassEnergy + midEnergy + highEnergy) / 3;

    // Base rotation speed for counter-clockwise rotation (negative value)
    const baseRotationSpeed = -0.001;
    // Maximum rotation speed for counter-clockwise rotation (negative value)
    const maxRotationSpeed = -0.1;

    // Calculate final rotation speed based on audio energy
    const rotationSpeed = baseRotationSpeed +
      (maxRotationSpeed - baseRotationSpeed) * totalEnergy * enhancedSensitivity;

    if (earthRef.current && atmosphereRef.current) {
      // Apply counter-clockwise rotation while maintaining the tilt
      earthRef.current.rotation.y += rotationSpeed;
      atmosphereRef.current.rotation.y += rotationSpeed;

      // Update atmosphere color based on energy
      const atmosphereMaterial = atmosphereRef.current.material as THREE.MeshStandardMaterial;
      const energyColor = getColorFromEnergy(
        bassEnergy,
        midEnergy,
        highEnergy,
        config.colorMode,
        config.baseColor
      );
      const color = new THREE.Color(energyColor);
      atmosphereMaterial.emissive = color;
      atmosphereMaterial.color = color;
      atmosphereMaterial.emissiveIntensity = 0.3 + beatAnimationRef.current * 0.1;
      atmosphereMaterial.opacity = 0.15 + totalEnergy * 0.1;
    }

    // Calculate particle count based on audio energy
    const baseParticleCount = Math.floor(maxParticlesRef.current * (isSmallScreen ? 0.3 : 0.2));
    const dynamicParticleCount = Math.floor(
      baseParticleCount + (maxParticlesRef.current - baseParticleCount) * totalEnergy * enhancedSensitivity
    );

    // Calculate particle speed based on audio
    const averageFrequency = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
    const baseSpeed = 0.2;
    const dynamicSpeed = baseSpeed + (averageFrequency / 255) * enhancedMotion;

    // Beat animation
    if (beat) {
      beatAnimationRef.current = 1;
    } else {
      beatAnimationRef.current *= 0.95;
    }

    // Define viewing boundaries relative to earth size
    // These values are fixed for reliable in-frame particles
    const earthRadius = earthSize.current;

    // Fixed values that work on all screen sizes
    const spawnDistance = earthRadius * 6;
    const spawnYRange = earthRadius * 3.5;
    const resetBoundaryX = -earthRadius * 6;
    const resetBoundaryY = earthRadius * 4;

    // Make particles bigger on smaller screens
    const particleSizeMultiplier = isSmallScreen ? 1.5 : 1;

    // Adjust magnetic field relative to earth
    const magneticFieldStrength = earthRadius * 1.5;

    // Update each flare
    solarFlaresRef.current.forEach((flare) => {
      const positions = flare.geometry.attributes.position.array as Float32Array;
      const velocities = flare.geometry.attributes.velocity.array as Float32Array;
      const colors = flare.geometry.attributes.color.array as Float32Array;
      const sizes = flare.geometry.attributes.size.array as Float32Array;

      // Update each particle
      for (let i = 0; i < positions.length; i += 3) {
        const particleIndex = i / 3;

        if (particleIndex < dynamicParticleCount) {
          // Initialize particles that are offscreen
          if (positions[i] === 1000) {
            // Position relative to earth size - guaranteed to be in frame
            positions[i] = spawnDistance + Math.random() * earthRadius;
            positions[i + 1] = -spawnYRange + Math.random() * (spawnYRange * 2);
            positions[i + 2] = (Math.random() - 0.5) * earthRadius * 0.5;

            velocities[i] = -dynamicSpeed - Math.random() * 0.1;
            velocities[i + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i + 2] = 0;

            sizes[particleIndex] = (0.3 + Math.random() * 0.2) * particleSizeMultiplier;
          }

          // Move particles
          positions[i] += velocities[i] * dynamicSpeed;
          positions[i + 1] += velocities[i + 1] * dynamicSpeed;

          // Calculate distance from earth center
          const distanceFromEarth = Math.sqrt(
            positions[i] * positions[i] +
            positions[i + 1] * positions[i + 1]
          );

          // Apply magnetic field effect near earth
          if (distanceFromEarth < magneticFieldStrength) {
            const angle = Math.atan2(positions[i + 1], positions[i]);

            const deflectionStrength = (1 - distanceFromEarth / magneticFieldStrength) *
              enhancedSensitivity * (1 + totalEnergy) * 0.5;

            const splitFactor = positions[i + 1] > 0 ? 1 : -1;

            velocities[i] += Math.cos(angle + Math.PI / 2) * deflectionStrength * 0.1;
            velocities[i + 1] += Math.sin(angle + Math.PI / 2) * deflectionStrength *
              splitFactor * 0.15;

            velocities[i] += (Math.random() - 0.5) * totalEnergy * 0.02;
            velocities[i + 1] += (Math.random() - 0.5) * totalEnergy * 0.02;

            if (beat) {
              velocities[i] *= 1.1;
              velocities[i + 1] *= 1.1;
            }
          }

          // Recycle particles that move out of view
          if (positions[i] < resetBoundaryX || Math.abs(positions[i + 1]) > resetBoundaryY) {
            positions[i] = spawnDistance + Math.random() * earthRadius;
            positions[i + 1] = -spawnYRange + Math.random() * (spawnYRange * 2);
            velocities[i] = -dynamicSpeed - Math.random() * 0.1;
            velocities[i + 1] = (Math.random() - 0.5) * 0.1;
          }

          // Set particle color based on audio energy
          const energyColor = getColorFromEnergy(
            bassEnergy,
            midEnergy,
            highEnergy,
            config.colorMode,
            config.baseColor
          );

          const color = new THREE.Color(energyColor);
          colors[i] = color.r;
          colors[i + 1] = color.g;
          colors[i + 2] = color.b;

          // Set particle size based on beat and energy
          sizes[particleIndex] = (0.3 + beatAnimationRef.current * 0.2 + totalEnergy * 0.3) * particleSizeMultiplier;
        } else {
          // Keep unused particles offscreen
          positions[i] = 1000;
          positions[i + 1] = 1000;
          positions[i + 2] = 1000;
        }
      }

      flare.geometry.attributes.position.needsUpdate = true;
      flare.geometry.attributes.color.needsUpdate = true;
      flare.geometry.attributes.size.needsUpdate = true;

      // Update base particle size based on screen size and beat
      const material = flare.material as THREE.PointsMaterial;
      material.size = (0.3 + beatAnimationRef.current * 0.2 * enhancedSensitivity) * particleSizeMultiplier;
    });
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 30, 150]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[30, 0, 0]} intensity={2} color="#ff6b3b" />
      <pointLight position={[-30, 0, 0]} intensity={1} color="#ff3b30" />

      {/* Earth and atmosphere are sized relative to camera distance */}
      <mesh ref={earthRef} position={[0, 0, 0]}>
        <sphereGeometry args={[earthSize.current, 64, 64]} />
        <meshStandardMaterial
          metalness={0.4}
          roughness={0.7}
        />
      </mesh>

      <mesh ref={atmosphereRef} position={[0, 0, 0]} scale={1.05}>
        <sphereGeometry args={[earthSize.current, 64, 64]} />
        <meshStandardMaterial
          transparent
          opacity={0.1}
          roughness={0.2}
          emissiveIntensity={0.5}
        />
      </mesh>

      {solarFlaresRef.current.map((flare, i) => (
        <primitive key={`flare-${i}`} object={flare} />
      ))}

      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          height={300}
        />
      </EffectComposer>
    </>
  );
};

const SolarFlarePattern: React.FC<SolarFlarePatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
      style={{ background: '#000000' }}
    >
      <Canvas>
        <SolarSystem
          audioData={audioData}
          config={config}
          dimensions={dimensions}
        />
      </Canvas>
    </motion.div>
  );
};

export default SolarFlarePattern;