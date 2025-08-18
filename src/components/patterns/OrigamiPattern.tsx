"use client"

import React from "react"
import { MeshGradient, PulsingBorder, GrainGradient } from "@paper-design/shaders-react"
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy, hexToHSL } from "../../utils/colorUtils";
import CreditsComponent from "../CreditsComponent";
import clsx from "clsx";

interface OrigamiPatternProps {
    audioData: AudioAnalysisData;
    config: VisualizationConfig;
    dimensions: { width: number; height: number };
    showControls: boolean;
}

const OrigamiPattern: React.FC<OrigamiPatternProps> = ({ audioData, config, showControls }) => {
    const { bassEnergy, midEnergy, highEnergy, volume } = audioData;
    const { sensitivity, motionIntensity, colorMode, baseColor } = config;

    const speed = 0.1 + (bassEnergy * 2 * motionIntensity);
    const pulse = midEnergy * 0.4 * sensitivity;
    const smoke = highEnergy * 0.8 * sensitivity;
    const intensity = 3 + bassEnergy * 6 * sensitivity;

    const color1 = getColorFromEnergy(bassEnergy, midEnergy, highEnergy, colorMode, baseColor);
    const color2 = getColorFromEnergy(midEnergy, highEnergy, bassEnergy, colorMode, baseColor);
    const color3 = getColorFromEnergy(highEnergy, bassEnergy, midEnergy, colorMode, baseColor);

    const turbulenceFreq = 0.005 + bassEnergy * 0.01;
    const displacementScale = 0.3 + midEnergy * 0.5;
    const gooStdDeviation = 4 + highEnergy * 3;

    let pulsingBorderColors: string[];
    let accentColor: string;

    if (colorMode === 'monochrome') {
        const hsl = hexToHSL(baseColor);
        pulsingBorderColors = Array.from({ length: 7 }, (_, i) => {
            const lightness = Math.max(10, Math.min(90, hsl.l + (i - 3) * 15 + (volume - 0.5) * 20));
            return `hsl(${hsl.h}, ${hsl.s}%, ${lightness}%)`;
        });
        accentColor = `hsl(${hsl.h}, ${hsl.s}%, ${90 + volume * 10}%)`;
    } else {
        pulsingBorderColors = Array.from({ length: 7 }, (_, i) =>
            getColorFromEnergy(
                bassEnergy * (1 + (i - 3) * 0.1),
                midEnergy * (1 + (i - 3) * 0.1),
                highEnergy * (1 + (i - 3) * 0.1),
                colorMode,
                baseColor
            )
        );
        accentColor = getColorFromEnergy(volume, volume, volume, 'dynamic', '#FFFFFF');
    }

    const grainScale = 1 + bassEnergy * 0.5;
    const grainColor1 = getColorFromEnergy(bassEnergy, highEnergy, midEnergy, 'dynamic', baseColor);
    const grainColor2 = getColorFromEnergy(highEnergy, bassEnergy, midEnergy, 'spectrum', baseColor);
    const grainColor3 = getColorFromEnergy(midEnergy, bassEnergy, highEnergy, 'dynamic', baseColor);
    const grainColor4 = accentColor;
    const grainColors: [string, string, string, string] = [grainColor1, grainColor2, grainColor3, grainColor4];

    return (
        <div className="w-full h-full bg-black relative overflow-hidden">
            {/* SVG Filters */}
            <svg className="absolute inset-0 w-0 h-0">
                <defs>
                    <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
                        <feTurbulence baseFrequency={turbulenceFreq} numOctaves="1" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale={displacementScale} />
                        <feColorMatrix
                            type="matrix"
                            values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
                            result="tint"
                        />
                    </filter>
                    <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation={gooStdDeviation} result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                            result="gooey"
                        />
                        <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
                    </filter>
                </defs>
            </svg>

            {/* Background Shaders */}
            <MeshGradient
                className="absolute inset-0 w-full h-full"
                colors={["#000000", color1, accentColor, color2, color3]}
                speed={speed}
            />
            <MeshGradient
                className="absolute inset-0 w-full h-full opacity-60"
                colors={["#000000", accentColor, color1, "#000000"]}
                speed={speed * 0.8}
            />
            <GrainGradient
                className="absolute inset-0 w-full h-full opacity-25"
                colors={grainColors}
                softness={0.6}
                scale={grainScale}
            />

            {/* Pulsing Circle */}
            <div className={clsx("absolute -right-11 -top-11 z-30", showControls ? "hidden lg:block" : "hidden")}>
                <div className="relative w-40 h-40 flex items-center justify-center">
                    <PulsingBorder
                        colors={pulsingBorderColors}
                        colorBack="#00000000"
                        speed={speed * 5}
                        className="w-20 h-20"
                        roundness={1}
                        thickness={0.1}
                        softness={3}
                        intensity={intensity}
                        spotSize={0.5}
                        pulse={pulse * 2}
                        smoke={smoke}
                        smokeSize={200}
                        scale={0.65 + volume * 0.4}
                        rotation={0.5}

                    />
                </div>
            </div>
            <CreditsComponent href="https://x.com/legionsdev/status/1956770794693853560" label="Adapted from @legionsdev" show={showControls} />
        </div>
    )
}

export default OrigamiPattern;
