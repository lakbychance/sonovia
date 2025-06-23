import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface RingsPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const RingsPattern: React.FC<RingsPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { frequencyData, bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) * 0.9;
    
    // Enhanced sensitivity and motion
    const enhancedSensitivity = config.sensitivity * 1.8;
    const enhancedMotion = config.motionIntensity * 1.6;
    
    // Number of rings based on frequency ranges
    const numRings = 12;
    const freqPerRing = Math.floor(frequencyData.length / numRings);
    
    for (let ring = 0; ring < numRings; ring++) {
      const ringProgress = ring / numRings;
      const baseRadius = maxRadius * ringProgress;
      
      // Calculate average frequency for this ring
      let ringEnergy = 0;
      for (let i = 0; i < freqPerRing; i++) {
        const freqIndex = ring * freqPerRing + i;
        ringEnergy += frequencyData[freqIndex] / 255;
      }
      ringEnergy /= freqPerRing;
      
      // Draw ring with enhanced effects
      ctx.beginPath();
      const segments = 64;
      const radiusVariation = ringEnergy * 70 * enhancedSensitivity;
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const time = Date.now() * 0.001 * enhancedMotion;
        
        // Enhanced wave effect
        const waveOffset = Math.sin(angle * 8 + time + ring) * radiusVariation;
        const radius = baseRadius + waveOffset;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Color based on ring position with enhanced energy
      let energy;
      if (ring < numRings * 0.33) {
        energy = bassEnergy * 1.2;
      } else if (ring < numRings * 0.66) {
        energy = midEnergy * 1.2;
      } else {
        energy = highEnergy * 1.2;
      }
      
      const color = getColorFromEnergy(
        ring < numRings * 0.33 ? energy : 0,
        ring >= numRings * 0.33 && ring < numRings * 0.66 ? energy : 0,
        ring >= numRings * 0.66 ? energy : 0,
        config.colorMode,
        config.baseColor
      );
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * enhancedMotion;
      
      // Enhanced glow effect
      if (beat || energy > 0.6) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 * enhancedMotion;
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [audioData, dimensions, config, isPlaying]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </motion.div>
  );
};

export default RingsPattern;