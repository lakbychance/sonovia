import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface LightRayPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const LightRays: React.FC<{ audioData: AudioAnalysisData; config: VisualizationConfig }> = ({ audioData, config }) => {
  const { frequencyData, bassEnergy, midEnergy, highEnergy, beat } = audioData;
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const { camera } = useThree();
  const time = useRef(0);
  const beatAnimationRef = useRef(0);
  
  // Set up camera with adjusted position
  useEffect(() => {
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 5, 0);
  }, [camera]);
  
  // Create meshes
  useEffect(() => {
    meshRefs.current = [];
    const numRays = 128; // Increased number of rays for better resolution
    const spacing = 0.25; // Decreased spacing for denser bars
    const totalWidth = (numRays - 1) * spacing;
    
    for (let i = 0; i < numRays; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1, 0.15), // Slightly thinner bars
        new THREE.MeshStandardMaterial({
          metalness: 0.9,
          roughness: 0.2,
          emissive: new THREE.Color(0xff3b30),
          emissiveIntensity: 0,
        })
      );
      
      mesh.position.x = (i * spacing) - (totalWidth / 2);
      mesh.position.y = 0.5;
      meshRefs.current.push(mesh);
    }
  }, []);
  
  // Animate meshes
  useFrame((state) => {
    time.current += 0.016;
    const enhancedSensitivity = config.sensitivity * 1.5;
    const enhancedMotion = config.motionIntensity * 1.2;
    
    // Beat animation decay
    if (beat) {
      beatAnimationRef.current = 1;
    } else {
      beatAnimationRef.current *= 0.95;
    }
    
    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const amplitude = frequencyData[i] / 255;
      
      // Enhanced height calculation with beat influence
      const baseHeight = 1 + (amplitude * 8 * enhancedSensitivity);
      const beatBoost = beatAnimationRef.current * amplitude * 2;
      const finalHeight = baseHeight + beatBoost;
      
      // Smooth height transition
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, finalHeight, 0.2);
      mesh.position.y = mesh.scale.y / 2;
      
      // Dynamic rotation based on energy and beat
      const rotationSpeed = 0.02 * enhancedMotion;
      const beatRotation = beat ? Math.sin(time.current * 10) * 0.1 : 0;
      mesh.rotation.y = Math.sin(time.current + i * 0.1) * rotationSpeed + beatRotation;
      
      // Position wave effect
      const waveOffset = Math.sin(time.current * 2 + i * 0.1) * 0.1 * enhancedMotion;
      mesh.position.z = waveOffset * amplitude;
      
      const material = mesh.material as THREE.MeshStandardMaterial;
      let energy;
      
      // Enhanced frequency range distribution
      if (i < meshRefs.current.length * 0.33) {
        energy = bassEnergy;
      } else if (i < meshRefs.current.length * 0.66) {
        energy = midEnergy;
      } else {
        energy = highEnergy;
      }
      
      // Dynamic color with beat influence
      const color = getColorFromEnergy(
        i < meshRefs.current.length * 0.33 ? energy : 0,
        i >= meshRefs.current.length * 0.33 && i < meshRefs.current.length * 0.66 ? energy : 0,
        i >= meshRefs.current.length * 0.66 ? energy : 0,
        config.colorMode,
        config.baseColor
      );
      
      const threeColor = new THREE.Color(color);
      material.emissive = threeColor;
      material.color = threeColor;
      
      // Enhanced emissive intensity with beat reaction
      const baseIntensity = energy * enhancedMotion;
      const beatIntensity = beat ? 2 : 1;
      const finalIntensity = baseIntensity * beatIntensity * (1 + beatAnimationRef.current);
      
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        finalIntensity,
        0.2
      );
    });
  });
  
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff3b30" />
      <fog attach="fog" args={['#121212', 15, 50]} />
      
      {/* Reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.3}
          emissive="#1a1a1a"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {meshRefs.current.map((mesh, i) => (
        <primitive key={i} object={mesh} />
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

const LightRayPattern: React.FC<LightRayPatternProps> = ({
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
        <LightRays audioData={audioData} config={config} />
      </Canvas>
    </motion.div>
  );
};

export default LightRayPattern;