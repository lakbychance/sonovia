import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface StockGraphPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

interface Point {
  x: number;
  y: number;
  energy: number;
  speed: number;
}

const StockGraphPattern: React.FC<StockGraphPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const viewportXRef = useRef(0);
  const lastSpeedRef = useRef(2);
  
  // Helper function to draw arrow
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    size: number
  ) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLength = size * 3;
    const arrowWidth = size * 2;
    
    // Calculate arrow points
    const tipX = toX;
    const tipY = toY;
    const leftX = tipX - arrowLength * Math.cos(angle - Math.PI / 6);
    const leftY = tipY - arrowLength * Math.sin(angle - Math.PI / 6);
    const rightX = tipX - arrowLength * Math.cos(angle + Math.PI / 6);
    const rightY = tipY - arrowLength * Math.sin(angle + Math.PI / 6);
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.fill();
    
    if (beat) {
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 2;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };
  
  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // Clear canvas with a dark background
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate new point
    const totalEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
    
    // Dynamic speed calculation based on audio features
    const baseSpeed = 2 * config.motionIntensity;
    const speedMultiplier = 1 + (
      bassEnergy * 2 +    // Bass provides main momentum
      midEnergy * 1.5 +   // Mids add moderate boost
      highEnergy         // Highs add slight boost
    ) * config.sensitivity;
    
    // Smooth speed transitions
    const targetSpeed = baseSpeed * speedMultiplier;
    const smoothedSpeed = lastSpeedRef.current + (targetSpeed - lastSpeedRef.current) * 0.2;
    lastSpeedRef.current = smoothedSpeed;
    
    // Get the last point or create initial point at origin
    const lastPoint = pointsRef.current[pointsRef.current.length - 1] || {
      x: 0,
      y: dimensions.height - 50, // Start at origin (with small offset for visibility)
      energy: totalEnergy,
      speed: smoothedSpeed
    };
    
    // Calculate resistance based on height
    const heightProgress = 1 - (lastPoint.y / dimensions.height);
    const resistance = Math.pow(heightProgress, 3) * 12;
    
    // Calculate direction based on audio features with resistance
    const yChange = (
      (midEnergy - 0.5) * 15 * config.sensitivity +
      (highEnergy - 0.9) * 1.8 * config.sensitivity +
      (bassEnergy - 0.75) * 10 * config.sensitivity
    ) - resistance;
    
    // Calculate new position with dynamic speed
    const newX = lastPoint.x + smoothedSpeed;
    
    // Add padding at top and bottom
    const topPadding = dimensions.height * 0.1;
    const bottomPadding = dimensions.height * 0.1;
    const minY = topPadding;
    const maxY = dimensions.height - bottomPadding;
    
    // Calculate new Y position with bounds checking
    const newY = Math.max(minY, Math.min(maxY,
      lastPoint.y - yChange
    ));
    
    // Add new point
    pointsRef.current.push({
      x: newX,
      y: newY,
      energy: totalEnergy,
      speed: smoothedSpeed
    });
    
    // Update viewport to follow the line with dynamic speed
    const viewportTarget = newX - dimensions.width * 0.5; // Show more of the line ahead
    viewportXRef.current += (viewportTarget - viewportXRef.current) * 0.1;
    
    // Remove points that are too far behind the viewport
    pointsRef.current = pointsRef.current.filter(
      point => point.x >= viewportXRef.current - 100
    );
    
    // Draw grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    
    // Vertical grid lines with speed-based spacing
    const gridSpacing = Math.max(30, Math.min(100, 50 / (smoothedSpeed / baseSpeed)));
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      const gridX = Math.floor(viewportXRef.current + x);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      
      // Draw time markers
      ctx.fillStyle = '#4a4a4a';
      ctx.font = '10px monospace';
      ctx.fillText(gridX.toString(), x + 5, canvas.height - 5);
    }
    
    // Horizontal grid lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
      
      // Draw value markers
      ctx.fillStyle = '#4a4a4a';
      ctx.font = '10px monospace';
      ctx.fillText((dimensions.height - y).toString(), 5, y + 15);
    }
    
    // Transform context to follow the line
    ctx.save();
    ctx.translate(-viewportXRef.current, 0);
    
    // Draw line
    if (pointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      
      // Draw smooth curve through points
      for (let i = 1; i < pointsRef.current.length; i++) {
        const point = pointsRef.current[i];
        const prevPoint = pointsRef.current[i - 1];
        const nextPoint = pointsRef.current[i + 1] || point;
        
        // Calculate control points for smooth curve
        const cp1x = prevPoint.x + (point.x - prevPoint.x) / 3;
        const cp1y = prevPoint.y + (point.y - prevPoint.y) / 3;
        const cp2x = point.x - (nextPoint.x - prevPoint.x) / 3;
        const cp2y = point.y - (nextPoint.y - prevPoint.y) / 3;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, point.x, point.y);
      }
      
      // Create gradient based on energy and speed
      const gradient = ctx.createLinearGradient(
        viewportXRef.current, 0,
        viewportXRef.current + dimensions.width, 0
      );
      
      pointsRef.current.forEach((point, i) => {
        const progress = i / (pointsRef.current.length - 1);
        const speedFactor = point.speed / baseSpeed;
        const color = getColorFromEnergy(
          bassEnergy * point.energy * speedFactor,
          midEnergy * point.energy,
          highEnergy * point.energy,
          config.colorMode,
          config.baseColor
        );
        gradient.addColorStop(progress, color);
      });
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2 + smoothedSpeed / baseSpeed;
      
      // Add glow effect on beats or high speed
      if (beat || smoothedSpeed > baseSpeed * 2) {
        ctx.shadowColor = getColorFromEnergy(
          bassEnergy,
          midEnergy,
          highEnergy,
          config.colorMode,
          config.baseColor
        );
        ctx.shadowBlur = 15 * (smoothedSpeed / baseSpeed);
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Draw moving average line
      const avgPeriod = Math.max(10, Math.min(30, Math.floor(20 / (smoothedSpeed / baseSpeed))));
      if (pointsRef.current.length > avgPeriod) {
        ctx.beginPath();
        ctx.moveTo(pointsRef.current[avgPeriod - 1].x, pointsRef.current[avgPeriod - 1].y);
        
        for (let i = avgPeriod; i < pointsRef.current.length; i++) {
          const sum = pointsRef.current
            .slice(i - avgPeriod, i)
            .reduce((acc, p) => acc + p.y, 0);
          const avgY = sum / avgPeriod;
          
          ctx.lineTo(pointsRef.current[i].x, avgY);
        }
        
        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Draw arrow at the end of the line
      const lastTwoPoints = pointsRef.current.slice(-2);
      if (lastTwoPoints.length === 2) {
        const [prevPoint, currentPoint] = lastTwoPoints;
        const arrowColor = getColorFromEnergy(
          bassEnergy,
          midEnergy,
          highEnergy,
          config.colorMode,
          config.baseColor
        );
        const arrowSize = 3 + (smoothedSpeed / baseSpeed) * 2;
        
        drawArrow(
          ctx,
          prevPoint.x,
          prevPoint.y,
          currentPoint.x + 10,
          currentPoint.y,
          arrowColor,
          arrowSize
        );
      }
    }
    
    ctx.restore();
    
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

export default StockGraphPattern;