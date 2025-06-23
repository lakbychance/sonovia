import React from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface HalosPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const Halos: React.FC<{ audioData: AudioAnalysisData; config: VisualizationConfig }> = ({ audioData, config }) => {
  const { frequencyData, bassEnergy, midEnergy, highEnergy, beat } = audioData;
  const { camera } = useThree();
  const ringsRef = React.useRef<THREE.Mesh[]>([]);

  // Set up camera
  React.useEffect(() => {
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Create rings
  React.useEffect(() => {
    ringsRef.current = [];
    const numRings = 12;

    for (let i = 0; i < numRings; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2 + i * 1.2, 0.2, 16, 100),
        new THREE.MeshStandardMaterial({
          metalness: 0.8,
          roughness: 0.2,
          emissive: new THREE.Color(0xff3b30),
          emissiveIntensity: 0,
          transparent: true,
          opacity: 0.8
        })
      );

      ring.position.y = i * 0.5;
      ring.rotation.x = Math.PI / 2;
      ringsRef.current.push(ring);
    }
  }, []);

  // Animate rings
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const enhancedSensitivity = config.sensitivity * 1.5;
    const enhancedMotion = config.motionIntensity * 1.2;

    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;

      const freqIndex = Math.floor((i / ringsRef.current.length) * frequencyData.length);
      const amplitude = frequencyData[freqIndex] / 255;

      // Calculate energy based on ring position
      let energy;
      if (i < ringsRef.current.length * 0.33) {
        energy = bassEnergy;
      } else if (i < ringsRef.current.length * 0.66) {
        energy = midEnergy;
      } else {
        energy = highEnergy;
      }

      // Update ring scale and position
      const targetScale = 1 + (amplitude * enhancedSensitivity * 0.5);
      ring.scale.set(targetScale, targetScale, 1);

      // Floating animation
      const floatOffset = Math.sin(time * 0.5 + i * 0.5) * 0.5 * enhancedMotion;
      ring.position.y = i * 0.5 + floatOffset;

      // Rotation animation
      ring.rotation.z = time * 0.2 * (i % 2 ? 1 : -1) * enhancedMotion;

      // Update material
      const material = ring.material as THREE.MeshStandardMaterial;
      const color = getColorFromEnergy(
        i < ringsRef.current.length * 0.33 ? energy : 0,
        i >= ringsRef.current.length * 0.33 && i < ringsRef.current.length * 0.66 ? energy : 0,
        i >= ringsRef.current.length * 0.66 ? energy : 0,
        config.colorMode,
        config.baseColor
      );

      const threeColor = new THREE.Color(color);
      material.emissive = threeColor;
      material.color = threeColor;

      // Enhanced glow on beat
      const targetIntensity = energy * enhancedMotion * (beat ? 2 : 1);
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        targetIntensity,
        0.2
      );

      // Update opacity based on energy
      material.opacity = THREE.MathUtils.lerp(0.4, 0.8, energy);
    });
  });

  return (
    <>
      <fog attach="fog" args={['#121212', 5, 40]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 10, 10]} intensity={1} />
      <pointLight position={[10, 0, 0]} intensity={0.5} color="#ff3b30" />
      <pointLight position={[-10, 0, 0]} intensity={0.5} color="#0a84ff" />
      {ringsRef.current.map((ring, i) => (
        <primitive key={i} object={ring} />
      ))}
    </>
  );
};

const HalosPattern: React.FC<HalosPatternProps> = ({
  audioData,
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
        <Halos audioData={audioData} config={config} />
      </Canvas>
    </motion.div>
  );
};

export default HalosPattern;