import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface PlanetaryPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const Planet: React.FC<{ audioData: AudioAnalysisData; config: VisualizationConfig }> = ({ audioData, config }) => {
  const { camera } = useThree();
  const planetRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.Points[]>([]);
  const initialCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 30));
  
  // Set up camera
  useEffect(() => {
    camera.position.copy(initialCameraPosition.current);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  // Create planet and rings
  useEffect(() => {
    // Planet
    if (!planetRef.current) return;
    
    // Create rings
    const numRings = 8;
    ringsRef.current = [];
    particlesRef.current = [];
    
    for (let i = 0; i < numRings; i++) {
      // Ring geometry
      const ringGeometry = new THREE.RingGeometry(
        6 + i * 1.2, // inner radius
        7 + i * 1.2, // outer radius
        128 // segments
      );
      
      // Ring material
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xff3b30),
        metalness: 0.9,
        roughness: 0.2,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0xff3b30),
        emissiveIntensity: 0.5
      });
      
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ringsRef.current.push(ring);
      
      // Particles for each ring
      const particlesCount = 1000;
      const particlesGeometry = new THREE.BufferGeometry();
      const particlesPositions = new Float32Array(particlesCount * 3);
      
      for (let j = 0; j < particlesCount * 3; j += 3) {
        const angle = (Math.random() * Math.PI * 2);
        const radius = 6.5 + i * 1.2 + (Math.random() - 0.5) * 0.8;
        
        particlesPositions[j] = Math.cos(angle) * radius;
        particlesPositions[j + 1] = (Math.random() - 0.5) * 0.2;
        particlesPositions[j + 2] = Math.sin(angle) * radius;
      }
      
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));
      
      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: new THREE.Color(0xff3b30),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      
      const particles = new THREE.Points(particlesGeometry, particlesMaterial);
      particlesRef.current.push(particles);
    }
  }, []);
  
  // Animate planet and rings
  useFrame((state) => {
    if (!planetRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const { bassEnergy, midEnergy, highEnergy, beat } = audioData;
    const enhancedSensitivity = config.sensitivity * 1.2;
    const enhancedMotion = config.motionIntensity * 1.5;
    
    // Planet rotation
    planetRef.current.rotation.y += 0.002 * enhancedMotion;
    
    // Update planet material based on average ring energy
    const planetMaterial = planetRef.current.material as THREE.MeshStandardMaterial;
    const averageEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
    const planetBaseColor = getColorFromEnergy(
      bassEnergy * 0.7,
      midEnergy * 0.7,
      highEnergy * 0.7,
      config.colorMode,
      config.baseColor
    );
    planetMaterial.color = new THREE.Color(planetBaseColor);
    planetMaterial.emissive = new THREE.Color(planetBaseColor);
    planetMaterial.emissiveIntensity = 0.3 + averageEnergy * 0.5;
    
    // Camera movement
    const cameraRadius = 30 + Math.sin(time * 0.2) * 5 * enhancedMotion;
    const cameraAngle = time * 0.1 * enhancedMotion;
    const targetCameraPosition = new THREE.Vector3(
      Math.cos(cameraAngle) * cameraRadius,
      15 + Math.sin(time * 0.3) * 5 * enhancedMotion,
      Math.sin(cameraAngle) * cameraRadius
    );
    
    camera.position.lerp(targetCameraPosition, 0.02);
    camera.lookAt(0, 0, 0);
    
    // Animate rings and particles
    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;
      
      const ringEnergy = i < 3 ? bassEnergy : i < 6 ? midEnergy : highEnergy;
      const rotationSpeed = 0.001 * (i + 1) * enhancedMotion;
      
      // Ring rotation and scale
      ring.rotation.z += rotationSpeed * (1 + ringEnergy * enhancedSensitivity);
      const scaleOffset = 1 + ringEnergy * 0.2 * enhancedSensitivity;
      ring.scale.set(scaleOffset, scaleOffset, 1);
      
      // Update ring material
      const material = ring.material as THREE.MeshStandardMaterial;
      const color = getColorFromEnergy(
        i < 3 ? ringEnergy : 0,
        i >= 3 && i < 6 ? ringEnergy : 0,
        i >= 6 ? ringEnergy : 0,
        config.colorMode,
        config.baseColor
      );
      
      material.color = new THREE.Color(color);
      material.emissive = new THREE.Color(color);
      material.emissiveIntensity = 0.5 + ringEnergy * enhancedSensitivity;
      material.opacity = 0.4 + ringEnergy * 0.4;
      
      // Animate particles
      if (particlesRef.current[i]) {
        const particles = particlesRef.current[i];
        particles.rotation.z += rotationSpeed * 0.5;
        
        const particlesMaterial = particles.material as THREE.PointsMaterial;
        particlesMaterial.color = new THREE.Color(color);
        particlesMaterial.size = 0.05 + ringEnergy * 0.05 * enhancedSensitivity;
        particlesMaterial.opacity = 0.6 + ringEnergy * 0.4;
      }
    });
  });
  
  return (
    <>
      <fog attach="fog" args={['#121212', 20, 100]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[20, 10, 20]} intensity={1.5} />
      <pointLight position={[-20, -10, -20]} intensity={0.8} color="#ff3b30" />
      
      {/* Planet */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[4, 64, 64]} />
        <meshStandardMaterial
          metalness={0.8}
          roughness={0.3}
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Rings */}
      {ringsRef.current.map((ring, i) => (
        <primitive key={`ring-${i}`} object={ring} />
      ))}
      
      {/* Particles */}
      {particlesRef.current.map((particles, i) => (
        <primitive key={`particles-${i}`} object={particles} />
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

const PlanetaryPattern: React.FC<PlanetaryPatternProps> = ({
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
      style={{ background: '#121212' }}
    >
      <Canvas>
        <Planet audioData={audioData} config={config} />
      </Canvas>
    </motion.div>
  );
};

export default PlanetaryPattern;