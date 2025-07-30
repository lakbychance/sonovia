import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface ClockPatternProps {
    audioData: AudioAnalysisData;
    dimensions: { width: number; height: number };
    config: VisualizationConfig;
}

const ClockPattern: React.FC<ClockPatternProps> = ({
    audioData,
    dimensions,
    config,
}) => {
    const { bassEnergy, midEnergy, highEnergy, beat, isPlaying, volume } = audioData;
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate initial angles based on current time
    const getCurrentTimeAngles = () => {
        const now = new Date();
        const hours = now.getHours() % 12; // Convert to 12-hour format
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Calculate angles (0° = 12 o'clock position)
        const secondsAngle = seconds * 6; // 360° / 60 seconds = 6° per second
        const minutesAngle = minutes * 6 + (seconds * 0.1); // 6° per minute + smooth seconds contribution

        // Hour hand: each hour = 30°, each minute moves it 0.5°
        // At 2:00 it points at 2, at 2:30 it's halfway between 2 and 3
        const hoursAngle = (hours * 30) + (minutes * 0.5); // 30° per hour + 0.5° per minute

        return { secondsAngle, minutesAngle, hoursAngle };
    };

    const initialAngles = getCurrentTimeAngles();
    const [secondsAngle, setSecondsAngle] = useState(initialAngles.secondsAngle);
    const [minutesAngle, setMinutesAngle] = useState(initialAngles.minutesAngle);
    const [hoursAngle, setHoursAngle] = useState(initialAngles.hoursAngle);
    const [vibrationOffset, setVibrationOffset] = useState({ x: 0, y: 0 });
    const animationRef = useRef<number>();
    const lastTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.35;

        const animate = () => {
            const now = Date.now();
            const deltaTime = now - lastTimeRef.current;
            lastTimeRef.current = now;

            if (isPlaying) {
                // Calculate speed multipliers based on audio features with higher sensitivity
                const baseSpeed = config.sensitivity * config.motionIntensity;
                const energyBoost = 1 + (highEnergy + midEnergy + bassEnergy) * 2; // Extra boost for any energy

                // More sensitive speed calculations
                const secondsSpeed = (1 + Math.pow(highEnergy * baseSpeed * 5, 1.5)) * energyBoost * (deltaTime / 1000) * 8;
                const minutesSpeed = (1 + Math.pow(midEnergy * baseSpeed * 4, 1.3)) * energyBoost * (deltaTime / 1000) * 0.15;
                const hoursSpeed = (1 + Math.pow(bassEnergy * baseSpeed * 3, 1.2)) * energyBoost * (deltaTime / 1000) * 0.012;

                // Calculate vibration based on total energy
                const totalEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
                const vibeIntensity = totalEnergy * config.sensitivity * 3;
                const vibeX = (Math.random() - 0.5) * vibeIntensity * 2;
                const vibeY = (Math.random() - 0.5) * vibeIntensity * 2;

                setVibrationOffset({ x: vibeX, y: vibeY });

                // Update angles (anticlockwise rotation)
                setSecondsAngle(prev => (prev - secondsSpeed + 360) % 360);
                setMinutesAngle(prev => (prev - minutesSpeed + 360) % 360);
                setHoursAngle(prev => (prev - hoursSpeed + 360) % 360);
            }

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Get colors based on audio energy
            const clockColor = getColorFromEnergy(
                bassEnergy,
                midEnergy,
                highEnergy,
                config.colorMode,
                config.baseColor
            );

            const secondsColor = getColorFromEnergy(
                highEnergy,
                0,
                0,
                config.colorMode,
                config.baseColor
            );

            const minutesColor = getColorFromEnergy(
                0,
                midEnergy,
                0,
                config.colorMode,
                config.baseColor
            );

            const hoursColor = getColorFromEnergy(
                bassEnergy,
                0,
                0,
                config.colorMode,
                config.baseColor
            );

            // Draw hour markers with glow effect when second hand passes
            const hourMarkerSecondsAngle = ((secondsAngle % 360) + 360) % 360; // Ensure positive angle

            for (let i = 0; i < 12; i++) {
                const markerAngle = i * 30; // Each hour marker is 30° apart
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const innerRadius = radius * 0.85;
                const outerRadius = radius * 0.95;

                const x1 = centerX + Math.cos(angle) * innerRadius;
                const y1 = centerY + Math.sin(angle) * innerRadius;
                const x2 = centerX + Math.cos(angle) * outerRadius;
                const y2 = centerY + Math.sin(angle) * outerRadius;

                // Calculate if second hand is near this hour marker (within 15° on each side)
                let angleDiff = Math.abs(hourMarkerSecondsAngle - markerAngle);
                if (angleDiff > 180) angleDiff = 360 - angleDiff; // Handle wrap-around

                const isNearSecondHand = angleDiff <= 15;
                const glowIntensity = isNearSecondHand ? Math.max(0.3, 1 - (angleDiff / 15)) : 0;

                if (isNearSecondHand && glowIntensity > 0) {
                    // Draw glow effect for hour marker
                    const glowSize = 4 + (highEnergy * 6);
                    const glowAlpha = glowIntensity * (0.7 + highEnergy * 0.3);

                    ctx.save();
                    ctx.shadowColor = secondsColor;
                    ctx.shadowBlur = glowSize * 2;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.globalAlpha = glowAlpha;

                    // Draw multiple glow layers for stronger effect
                    for (let layer = 0; layer < 3; layer++) {
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = secondsColor;
                        ctx.lineWidth = 5 + layer;
                        ctx.stroke();
                    }

                    ctx.restore();
                }

                // Draw normal hour marker
                ctx.globalAlpha = 0.6 + volume * 0.4;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = isNearSecondHand ? secondsColor : clockColor;
                ctx.lineWidth = isNearSecondHand ? 4 : 3; // Thicker when active
                ctx.stroke();
            }

            // Draw swirly minute markers with audio-reactive patterns
            ctx.globalAlpha = 0.3 + volume * 0.3;
            for (let i = 0; i < 60; i++) {
                if (i % 5 !== 0) { // Skip hour markers
                    const angle = (i * 6 - 90) * (Math.PI / 180);

                    // Make markers more directly responsive to audio
                    const markerIndex = i;

                    // Assign different markers to different frequency ranges for variety
                    let primaryEnergy;
                    if (markerIndex % 3 === 0) {
                        primaryEnergy = bassEnergy; // Every 3rd marker responds to bass
                    } else if (markerIndex % 3 === 1) {
                        primaryEnergy = midEnergy; // Next third responds to mids
                    } else {
                        primaryEnergy = highEnergy; // Final third responds to highs
                    }

                    // Add some cross-frequency influence for bouncy effect
                    const secondaryEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
                    const totalEnergy = primaryEnergy * 0.7 + secondaryEnergy * 0.3;

                    // More aggressive expansion with higher sensitivity
                    const bouncyExpansion = Math.pow(totalEnergy * config.sensitivity * 3, 1.8) * 0.25; // Up to 25% expansion

                    // Add beat pulse for extra bounce
                    const beatBoost = beat ? 0.1 : 0;

                    // Random variation per marker for organic feel
                    const markerVariation = 0.8 + (Math.sin(markerIndex * 0.5) * 0.4);

                    const finalExpansion = (bouncyExpansion + beatBoost) * markerVariation;

                    const innerRadius = radius * (0.9 + finalExpansion * 0.2);
                    const outerRadius = radius * (0.95 + finalExpansion);

                    // Create swirly effect based on audio
                    const swirlyIntensity = totalEnergy * 0.3 + primaryEnergy * 0.2;
                    const timeOffset = Date.now() * 0.002;
                    const swirlyOffset = Math.sin(markerIndex * 0.8 + timeOffset) * swirlyIntensity * 15; // Angle offset in degrees

                    // Calculate swirly positions
                    const x1 = centerX + Math.cos(angle) * innerRadius;
                    const y1 = centerY + Math.sin(angle) * innerRadius;

                    // Create curved path with multiple control points
                    const midRadius = (innerRadius + outerRadius) / 2;
                    const swirlyAngle1 = angle + (swirlyOffset * Math.PI / 180);
                    const swirlyAngle2 = angle + (swirlyOffset * 0.5 * Math.PI / 180);

                    const xMid = centerX + Math.cos(swirlyAngle1) * midRadius;
                    const yMid = centerY + Math.sin(swirlyAngle1) * midRadius;
                    const x2 = centerX + Math.cos(swirlyAngle2) * outerRadius;
                    const y2 = centerY + Math.sin(swirlyAngle2) * outerRadius;

                    // Draw swirly marker using quadratic curve
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.quadraticCurveTo(xMid, yMid, x2, y2);
                    ctx.strokeStyle = clockColor;
                    ctx.lineWidth = 1 + (finalExpansion * 3); // More dramatic line thickness changes
                    ctx.stroke();
                }
            }

            // Draw numbers with glow effect when second hand passes
            const normalizedSecondsAngle = ((secondsAngle % 360) + 360) % 360; // Ensure positive angle

            for (let i = 1; i <= 12; i++) {
                const numberAngle = i * 30; // Each number is 30° apart (starting from 1 o'clock)
                const angle = (i * 30 - 90) * (Math.PI / 180); // Adjust for canvas coordinate system
                const numberRadius = radius * 0.75;
                const x = centerX + Math.cos(angle) * numberRadius;
                const y = centerY + Math.sin(angle) * numberRadius;

                // Calculate if second hand is near this number (within 15° on each side)
                let angleDiff = Math.abs(normalizedSecondsAngle - numberAngle);
                if (angleDiff > 180) angleDiff = 360 - angleDiff; // Handle wrap-around

                const isNearSecondHand = angleDiff <= 15;
                const glowIntensity = isNearSecondHand ? Math.max(0.3, 1 - (angleDiff / 15)) : 0;

                if (isNearSecondHand && glowIntensity > 0) {
                    // Draw glow effect
                    const glowSize = 3 + (highEnergy * 5);
                    const glowAlpha = glowIntensity * (0.6 + highEnergy * 0.4);

                    ctx.save();
                    ctx.shadowColor = secondsColor;
                    ctx.shadowBlur = glowSize * 2;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.globalAlpha = glowAlpha;

                    // Draw multiple glow layers for stronger effect
                    for (let layer = 0; layer < 3; layer++) {
                        ctx.fillStyle = secondsColor;
                        ctx.font = `bold ${Math.max(14, radius * 0.14)}px Arial`;
                        ctx.fillText(i.toString(), x, y);
                    }

                    ctx.restore();
                }

                // Draw normal number
                ctx.globalAlpha = 0.8 + volume * 0.2;
                ctx.fillStyle = isNearSecondHand ? secondsColor : clockColor;
                ctx.font = `${isNearSecondHand ? 'bold ' : ''}${Math.max(12, radius * 0.12)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(i.toString(), x, y);
            }

            // Apply vibration to center point
            const vibratedCenterX = centerX + vibrationOffset.x;
            const vibratedCenterY = centerY + vibrationOffset.y;

            // Draw hour hand
            ctx.globalAlpha = 0.9;
            // Ensure hour angle is properly normalized and positioned
            const normalizedHourAngle = hoursAngle % 360;
            const hourAngleRad = (normalizedHourAngle - 90) * (Math.PI / 180);
            const hourLength = radius * 0.5;
            ctx.beginPath();
            ctx.moveTo(vibratedCenterX, vibratedCenterY);
            ctx.lineTo(
                vibratedCenterX + Math.cos(hourAngleRad) * hourLength,
                vibratedCenterY + Math.sin(hourAngleRad) * hourLength
            );
            ctx.strokeStyle = hoursColor;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Draw minute hand
            const minuteAngleRad = (minutesAngle - 90) * (Math.PI / 180);
            const minuteLength = radius * 0.7;
            ctx.beginPath();
            ctx.moveTo(vibratedCenterX, vibratedCenterY);
            ctx.lineTo(
                vibratedCenterX + Math.cos(minuteAngleRad) * minuteLength,
                vibratedCenterY + Math.sin(minuteAngleRad) * minuteLength
            );
            ctx.strokeStyle = minutesColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Draw sweep effect behind second hand (trailing effect)
            const sweepLength = 120; // degrees of sweep trail
            const sweepSecondsAngle = ((secondsAngle % 360) + 360) % 360;

            for (let i = 2; i < sweepLength; i += 3) {
                // Since clock moves anticlockwise, trail appears clockwise (+i)
                const sweepAngle = sweepSecondsAngle + i;
                const sweepAngleRad = (sweepAngle - 90) * (Math.PI / 180);
                const fadeAlpha = (1 - (i / sweepLength)) * (0.2 + highEnergy * 0.3);

                if (fadeAlpha > 0.01) {
                    const sweepInnerRadius = radius * 0.3;
                    const sweepOuterRadius = radius * 0.8;

                    // Create gradient for sweep
                    const gradient = ctx.createRadialGradient(
                        vibratedCenterX, vibratedCenterY, sweepInnerRadius,
                        vibratedCenterX, vibratedCenterY, sweepOuterRadius
                    );

                    // Convert color to RGBA format for proper transparency
                    const rgbMatch = secondsColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    const hslMatch = secondsColor.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);

                    if (rgbMatch) {
                        const [, r, g, b] = rgbMatch;
                        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${fadeAlpha})`);
                        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${fadeAlpha * 0.4})`);
                        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                    } else if (hslMatch) {
                        const [, h, s, l] = hslMatch;
                        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${fadeAlpha})`);
                        gradient.addColorStop(0.7, `hsla(${h}, ${s}%, ${l}%, ${fadeAlpha * 0.4})`);
                        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
                    } else {
                        // Fallback for hex colors
                        gradient.addColorStop(0, `${secondsColor}${Math.floor(fadeAlpha * 255).toString(16).padStart(2, '0')}`);
                        gradient.addColorStop(0.7, `${secondsColor}${Math.floor(fadeAlpha * 102).toString(16).padStart(2, '0')}`);
                        gradient.addColorStop(1, `${secondsColor}00`);
                    }

                    // Draw sweep segment
                    ctx.beginPath();
                    ctx.moveTo(vibratedCenterX, vibratedCenterY);
                    ctx.arc(vibratedCenterX, vibratedCenterY, sweepOuterRadius, sweepAngleRad - 0.03, sweepAngleRad + 0.03);
                    ctx.closePath();
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
            }

            // Draw second hand with extra vibration
            const secondVibeX = vibrationOffset.x * 1.5;
            const secondVibeY = vibrationOffset.y * 1.5;
            const secondAngleRad = (secondsAngle - 90) * (Math.PI / 180);
            const secondLength = radius * 0.8;
            ctx.beginPath();
            ctx.moveTo(vibratedCenterX + secondVibeX, vibratedCenterY + secondVibeY);
            ctx.lineTo(
                vibratedCenterX + secondVibeX + Math.cos(secondAngleRad) * secondLength,
                vibratedCenterY + secondVibeY + Math.sin(secondAngleRad) * secondLength
            );
            ctx.strokeStyle = secondsColor;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Draw center dot with vibration
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(vibratedCenterX, vibratedCenterY, 8, 0, Math.PI * 2);
            ctx.fillStyle = clockColor;
            ctx.fill();

            // Draw smaller center dot
            ctx.beginPath();
            ctx.arc(vibratedCenterX, vibratedCenterY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [audioData, dimensions, config, isPlaying]);

    return (
        <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
                perspective: '1000px', // Add perspective for 3D effect
            }}
        >
            <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{
                    filter: beat ? `brightness(1.2) saturate(1.2)` : 'brightness(1)',
                    transformStyle: 'preserve-3d',
                    transition: beat ? 'none' : 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
                }}
            />
        </motion.div>
    );
};

export default ClockPattern; 