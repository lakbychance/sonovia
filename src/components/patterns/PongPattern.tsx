import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface PongPatternProps {
    audioData: AudioAnalysisData;
    dimensions: { width: number; height: number };
    config: VisualizationConfig;
}

interface BallState {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface ScoreState {
    left: number;
    right: number;
}

interface PaddleState {
    leftY: number;
    rightY: number;
    leftX: number;
    rightX: number;
}

const PongPattern: React.FC<PongPatternProps> = ({
    audioData,
    dimensions,
    config,
}) => {
    const { bassEnergy, midEnergy, highEnergy, beat, isPlaying, volume } = audioData;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const [ballState, setBallState] = useState<BallState>({
        x: dimensions.width / 2,
        y: dimensions.height / 2,
        vx: 3,
        vy: 2
    });

    const [paddleState, setPaddleState] = useState<PaddleState>({
        leftY: dimensions.height / 2,
        rightY: dimensions.height / 2,
        leftX: 20, // Will be updated based on padding
        rightX: dimensions.width - 40 // Will be updated based on dimensions
    });

    const [scoreState, setScoreState] = useState<ScoreState>({
        left: 0,
        right: 0
    });

    const lastTimeRef = useRef<number>(0);
    const scoringRef = useRef<boolean>(false);
    const [lastScorer, setLastScorer] = useState<'left' | 'right' | null>(null);
    const leftMissChanceRef = useRef<number>(0);
    const rightMissChanceRef = useRef<number>(0);

    useEffect(() => {
        setBallState(prev => ({
            ...prev,
            x: dimensions.width / 2,
            y: dimensions.height / 2
        }));
        const padding = 20;
        const paddleWidth = Math.max(8, 20);
        setPaddleState({
            leftY: dimensions.height / 2,
            rightY: dimensions.height / 2,
            leftX: padding,
            rightX: dimensions.width - padding - paddleWidth
        });
    }, [dimensions]);

    const animate = (currentTime: number) => {
        if (!canvasRef.current || !isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            animationRef.current = requestAnimationFrame(animate);
            return;
        }

        lastTimeRef.current = currentTime;

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate paddle dimensions based on audio
        const paddleWidth = Math.max(8, 20 * config.sensitivity);

        // Fixed paddle height - 1/3 of container height
        const paddleHeight = dimensions.height / 3;

        // Audio features for horizontal movement and curvature
        const sharedEnergyMix = (bassEnergy * 0.5) + (midEnergy * 0.3) + (highEnergy * 0.2); // Balanced mix of all frequencies

        // Calculate curvature based on audio features (max 50% of semicircle)
        const maxCurvature = paddleWidth * 2; // Maximum inward curve distance
        const curvatureAmount = sharedEnergyMix * maxCurvature * config.sensitivity;

        // Calculate dynamic ball size based on audio features
        const minBallRadius = 6; // Minimum ball size
        const maxBallRadius = 12; // Maximum ball size
        const ballRadiusRange = maxBallRadius - minBallRadius;
        const ballRadius = minBallRadius + (sharedEnergyMix * ballRadiusRange * config.sensitivity);

        const padding = 20;
        const baseLeftX = padding;
        const baseRightX = dimensions.width - padding - paddleWidth;

        // Calculate horizontal movement based on audio features (air hockey style)
        // Reduce movement on smaller screens to prevent cramped gameplay
        const isSmallScreen = dimensions.width < 640;
        const horizontalMovementPercent = isSmallScreen ? 0.08 : 0.20; // 8% for small screens, 20% for larger screens
        const maxHorizontalMovement = dimensions.width * horizontalMovementPercent;

        // Balanced reactivity to audio changes - middle ground approach
        const sensitivityMultiplier = 1.6; // Moderate sensitivity increase
        const exponentialScale = 2.15; // Gentle exponential scaling to enhance small changes
        const scaledEnergyMix = Math.pow(sharedEnergyMix, exponentialScale);

        // Add subtle base movement for consistent visual activity
        const baseMovement = maxHorizontalMovement * 0.05; // 5% base movement
        const reactiveMovement = scaledEnergyMix * maxHorizontalMovement * config.motionIntensity * sensitivityMultiplier;

        const leftHorizontalOffset = baseMovement + reactiveMovement;
        const rightHorizontalOffset = baseMovement + reactiveMovement;

        const targetLeftX = baseLeftX + leftHorizontalOffset; // Left paddle moves right
        const targetRightX = baseRightX - rightHorizontalOffset; // Right paddle moves left

        // Update paddle positions with smooth interpolation (fixed height, only horizontal and vertical movement)
        setPaddleState(prev => {
            const trackingSpeed = 0.08 + (config.motionIntensity * 0.02); // Base tracking speed with config influence
            const beatSpeedBoost = beat ? 1.5 : 1; // Faster tracking on beats
            const audioSpeedBoost = 1 + (volume * 0.5); // Faster tracking with louder audio

            const finalTrackingSpeed = trackingSpeed * beatSpeedBoost * audioSpeedBoost;

            // Balanced horizontal interpolation - responsive but smooth
            const beatHorizontalBoost = beat ? 1.5 : 1.0; // Moderate beat boost for noticeable but not jarring response
            const horizontalSmoothingFactor = 0.5; // Middle ground between smooth and responsive
            const horizontalInterpolationSpeed = finalTrackingSpeed * horizontalSmoothingFactor * beatHorizontalBoost;

            const newLeftX = prev.leftX + (targetLeftX - prev.leftX) * horizontalInterpolationSpeed;
            const newRightX = prev.rightX + (targetRightX - prev.rightX) * horizontalInterpolationSpeed;

            // Add occasional misses - 5% chance (1 in 20) for each paddle to miss
            if (Math.random() < 0.05) {
                leftMissChanceRef.current = Math.random() * 0.8; // Miss by being 0-80% slower
            }
            if (Math.random() < 0.05) {
                rightMissChanceRef.current = Math.random() * 0.8; // Miss by being 0-80% slower  
            }

            // Gradually recover from misses
            leftMissChanceRef.current *= 0.98; // Slowly return to normal tracking
            rightMissChanceRef.current *= 0.98;

            // Calculate target positions (center the paddle on the ball) with miss factors
            const leftTargetY = ballState.y - paddleHeight / 2;
            const rightTargetY = ballState.y - paddleHeight / 2;

            // Apply miss factors to tracking speed
            const leftTrackingSpeed = finalTrackingSpeed * (1 - leftMissChanceRef.current);
            const rightTrackingSpeed = finalTrackingSpeed * (1 - rightMissChanceRef.current);

            // Smooth interpolation towards target position with occasional misses
            const newLeftY = prev.leftY + (leftTargetY - prev.leftY) * leftTrackingSpeed;
            const newRightY = prev.rightY + (rightTargetY - prev.rightY) * rightTrackingSpeed;

            // Keep paddles within screen bounds
            const constrainedLeftY = Math.max(0, Math.min(dimensions.height - paddleHeight, newLeftY));
            const constrainedRightY = Math.max(0, Math.min(dimensions.height - paddleHeight, newRightY));

            // Keep horizontal positions within bounds with minimum distance from center line
            const centerX = dimensions.width / 2;
            const isSmallScreenInner = dimensions.width < 640;

            // Minimum distance from center line to maintain visual clarity and gameplay space
            const minDistanceFromCenter = isSmallScreenInner ? dimensions.width * 0.15 : dimensions.width * 0.1; // 25% for small, 20% for large screens
            const minGap = isSmallScreenInner ? 40 : 20; // Gap between paddles

            // Calculate maximum inward positions based on minimum distance from center
            const leftMaxX = centerX - minDistanceFromCenter - paddleWidth;
            const rightMinX = centerX + minDistanceFromCenter;

            // Apply all constraints: screen bounds, minimum center distance, and paddle gap
            const constrainedLeftX = Math.max(
                padding,
                Math.min(leftMaxX, Math.min(centerX - paddleWidth - minGap, newLeftX))
            );
            const constrainedRightX = Math.max(
                rightMinX,
                Math.max(centerX + minGap, Math.min(dimensions.width - padding - paddleWidth, newRightX))
            );

            return {
                leftY: constrainedLeftY,
                rightY: constrainedRightY,
                leftX: constrainedLeftX,
                rightX: constrainedRightX
            };
        });

        const leftPaddleY = paddleState.leftY;
        const rightPaddleY = paddleState.rightY;
        const leftPaddleHeight = paddleHeight;
        const rightPaddleHeight = paddleHeight;
        const leftPaddleX = paddleState.leftX;
        const rightPaddleX = paddleState.rightX;

        // Calculate ball speed based on audio
        const baseSpeed = 3;
        const speedMultiplier = 1 + (volume * config.motionIntensity * 2);
        const beatBoost = beat ? 1.5 : 1;

        setBallState(prev => {
            let newX = prev.x + prev.vx * speedMultiplier * beatBoost;
            let newY = prev.y + prev.vy * speedMultiplier * beatBoost;
            let newVx = prev.vx;
            let newVy = prev.vy;

            // Bounce off top and bottom
            if (newY - ballRadius <= 0 || newY + ballRadius >= dimensions.height) {
                newVy = -newVy;
                newY = Math.max(ballRadius, Math.min(dimensions.height - ballRadius, newY));
            }

            // Bounce off left paddle (accounting for outward curve)
            const leftPaddleLeftEdge = leftPaddleX - curvatureAmount;
            if (newX - ballRadius <= leftPaddleX + paddleWidth &&
                newX >= leftPaddleLeftEdge &&
                newY >= leftPaddleY &&
                newY <= leftPaddleY + leftPaddleHeight &&
                newVx < 0) {
                newVx = Math.abs(newVx);
                newX = leftPaddleX + paddleWidth + ballRadius;
                // Add some randomness to the bounce angle based on curve
                const curveEffect = (curvatureAmount / maxCurvature) * 2; // More curve = more effect
                newVy += (Math.random() - 0.5) * (2 + curveEffect);
            }

            // Bounce off right paddle (accounting for outward curve)
            const rightPaddleRightEdge = rightPaddleX + paddleWidth + curvatureAmount;
            if (newX + ballRadius >= rightPaddleX &&
                newX <= rightPaddleRightEdge &&
                newY >= rightPaddleY &&
                newY <= rightPaddleY + rightPaddleHeight &&
                newVx > 0) {
                newVx = -Math.abs(newVx);
                newX = rightPaddleX - ballRadius;
                // Add some randomness to the bounce angle based on curve
                const curveEffect = (curvatureAmount / maxCurvature) * 2; // More curve = more effect
                newVy += (Math.random() - 0.5) * (2 + curveEffect);
            }

            // Detect scoring and reset ball
            if (newX < -30) {
                // Right side scores
                if (!scoringRef.current) {
                    setScoreState(prev => ({ ...prev, right: prev.right + 1 }));
                    setLastScorer('right');
                    scoringRef.current = true;
                    setTimeout(() => {
                        scoringRef.current = false;
                        setLastScorer(null);
                    }, 1000); // Prevent double scoring and clear scorer effect
                }
                newX = dimensions.width / 2;
                newY = dimensions.height / 2;
                newVx = Math.abs(baseSpeed); // Ball moves toward left side
                newVy = (Math.random() - 0.5) * baseSpeed;
            } else if (newX > dimensions.width + 30) {
                // Left side scores
                if (!scoringRef.current) {
                    setScoreState(prev => ({ ...prev, left: prev.left + 1 }));
                    setLastScorer('left');
                    scoringRef.current = true;
                    setTimeout(() => {
                        scoringRef.current = false;
                        setLastScorer(null);
                    }, 1000); // Prevent double scoring and clear scorer effect
                }
                newX = dimensions.width / 2;
                newY = dimensions.height / 2;
                newVx = -Math.abs(baseSpeed); // Ball moves toward right side
                newVy = (Math.random() - 0.5) * baseSpeed;
            }

            // Limit vertical velocity
            newVy = Math.max(-8, Math.min(8, newVy));

            return {
                x: newX,
                y: newY,
                vx: newVx,
                vy: newVy
            };
        });

        // Get colors for visualization elements
        const leftPaddleColor = getColorFromEnergy(
            bassEnergy,
            0,
            0,
            config.colorMode,
            config.baseColor
        );

        const rightPaddleColor = getColorFromEnergy(
            0,
            midEnergy,
            0,
            config.colorMode,
            config.baseColor
        );

        const ballColor = getColorFromEnergy(
            0,
            0,
            highEnergy,
            config.colorMode,
            config.baseColor
        );

        // Draw left paddle with outward curve
        ctx.fillStyle = leftPaddleColor;
        ctx.shadowColor = leftPaddleColor;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.moveTo(leftPaddleX + paddleWidth, leftPaddleY);
        ctx.lineTo(leftPaddleX, leftPaddleY);
        // Curved left edge (outward curve)
        ctx.quadraticCurveTo(
            leftPaddleX - curvatureAmount,
            leftPaddleY + leftPaddleHeight / 2,
            leftPaddleX,
            leftPaddleY + leftPaddleHeight
        );
        ctx.lineTo(leftPaddleX + paddleWidth, leftPaddleY + leftPaddleHeight);
        ctx.closePath();
        ctx.fill();

        // Draw right paddle with outward curve
        ctx.fillStyle = rightPaddleColor;
        ctx.shadowColor = rightPaddleColor;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.moveTo(rightPaddleX, rightPaddleY);
        ctx.lineTo(rightPaddleX + paddleWidth, rightPaddleY);
        // Curved right edge (outward curve)
        ctx.quadraticCurveTo(
            rightPaddleX + paddleWidth + curvatureAmount,
            rightPaddleY + rightPaddleHeight / 2,
            rightPaddleX + paddleWidth,
            rightPaddleY + rightPaddleHeight
        );
        ctx.lineTo(rightPaddleX, rightPaddleY + rightPaddleHeight);
        ctx.closePath();
        ctx.fill();

        // Draw ball with trail effect - using dynamic radius from audio features

        // Ball trail
        ctx.shadowColor = ballColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(ballState.x, ballState.y, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = ballColor;
        ctx.fill();

        // Add a brighter center to the ball
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(ballState.x, ballState.y, ballRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw scores with highlight effect for recent scorer
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';

        // Left score
        if (lastScorer === 'left') {
            ctx.fillStyle = leftPaddleColor;
            ctx.shadowColor = leftPaddleColor;
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
        }
        ctx.fillText(scoreState.left.toString(), dimensions.width / 4, 60);

        // Right score
        if (lastScorer === 'right') {
            ctx.fillStyle = rightPaddleColor;
            ctx.shadowColor = rightPaddleColor;
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
        }
        ctx.fillText(scoreState.right.toString(), (dimensions.width * 3) / 4, 60);

        // Reset shadow for center line
        ctx.shadowBlur = 0;

        // Draw center line
        ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(dimensions.width / 2, 0);
        ctx.lineTo(dimensions.width / 2, dimensions.height);
        ctx.stroke();
        ctx.setLineDash([]);

        animationRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, dimensions, config, audioData]);

    return (
        <div className="w-full h-full relative">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{
                    background: 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)'
                }}
            />

            {/* Beat flash overlay */}
            {beat && (
                <motion.div
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at ${ballState.x}px ${ballState.y}px, ${getColorFromEnergy(
                            (bassEnergy + midEnergy + highEnergy) / 3,
                            0,
                            0,
                            config.colorMode,
                            config.baseColor
                        )}20 0%, transparent 50%)`
                    }}
                />
            )}
        </div>
    );
};

export default PongPattern; 