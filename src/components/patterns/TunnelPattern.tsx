import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface TunnelPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const TunnelPattern: React.FC<TunnelPatternProps> = ({
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
    const maxRadius = Math.min(centerX, centerY);
    
    // Enhanced sensitivity and motion
    const enhancedSensitivity = config.sensitivity * 2.8;
    const enhancedMotion = config.motionIntensity * 2.5;
    
    // Create tunnel segments
    const numSegments = 16;
    const pointsPerSegment = 32;
    
    // Enhanced time-based rotation
    const time = Date.now() * 0.001 * enhancedMotion;
    const baseRotation = time * 0.6;
    
    for (let s = numSegments - 1; s >= 0; s--) {
      const segmentProgress = s / numSegments;
      const segmentDepth = segmentProgress * 0.8 + 0.2;
      const radius = maxRadius * segmentDepth;
      
      // Calculate frequency range for this segment
      const freqStart = Math.floor((s / numSegments) * frequencyData.length);
      const freqEnd = Math.floor(((s + 1) / numSegments) * frequencyData.length);
      let segmentEnergy = 0;
      
      for (let i = freqStart; i < freqEnd; i++) {
        segmentEnergy += frequencyData[i] / 255;
      }
      segmentEnergy /= (freqEnd - freqStart);
      
      // Draw segment with enhanced effects
      ctx.beginPath();
      
      for (let p = 0; p <= pointsPerSegment; p++) {
        const angle = (p / pointsPerSegment) * Math.PI * 2;
        
        // Enhanced distortion based on audio
        const distortion = Math.sin(angle * 6 + time) * segmentEnergy * 70 * enhancedSensitivity;
        const adjustedRadius = radius + distortion * enhancedMotion;
        
        // Enhanced rotation that increases with depth
        const rotationAngle = angle + baseRotation * (1 - segmentDepth) * 2;
        
        const x = centerX + Math.cos(rotationAngle) * adjustedRadius;
        const y = centerY + Math.sin(rotationAngle) * adjustedRadius;
        
        if (p === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Enhanced color based on segment depth
      let energy;
      if (segmentDepth < 0.33) {
        energy = bassEnergy * 1.5;
      } else if (segmentDepth < 0.66) {
        energy = midEnergy * 1.5;
      } else {
        energy = highEnergy * 1.5;
      }
      
      const color = getColorFromEnergy(
        segmentDepth < 0.33 ? energy : 0,
        segmentDepth >= 0.33 && segmentDepth < 0.66 ? energy : 0,
        segmentDepth >= 0.66 ? energy : 0,
        config.colorMode,
        config.baseColor
      );
      
      ctx.strokeStyle = color;
      ctx.lineWidth = (3 * segmentDepth) * enhancedMotion;
      
      // Enhanced glow effect
      if (beat || energy > 0.5) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 35 * segmentDepth * enhancedMotion;
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

export default TunnelPattern;