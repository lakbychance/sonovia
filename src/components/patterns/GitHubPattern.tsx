import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Text, OrbitControls, Environment } from '@react-three/drei';
import { Toaster } from 'sonner';
import { showCustomToast } from '../../utils/toastUtils';
import { Search, Loader2 } from 'lucide-react';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { hexToHSL } from '../../utils/colorUtils';

interface GitHubPatternProps {
    audioData: AudioAnalysisData;
    config: VisualizationConfig;
    dimensions: { width: number; height: number };
}

// Define structure for month labels
interface MonthLabel {
    month: string;
    position: number; // This will be the x-coordinate for positioning
}

// Helper function to generate realistic GitHub contribution data
const generateContributionData = () => {
    const data = [];
    const weeks = 52;
    const days = 7;
    let totalContributions = 0;

    // Create a pattern with some streaks and natural-looking clusters
    for (let w = 0; w < weeks; w++) {
        const weekData = [];

        // Generate a base level of activity (low)
        for (let d = 0; d < days; d++) {
            // Basic probability for contributions
            const isWeekend = d === 0 || d === 6;
            const baseProbability = isWeekend ? 0.1 : 0.4;

            // Create streaks and patterns (matching image)
            // More intense activity in Feb, Apr-May, Jul-Aug, Oct-Dec
            const isActiveMonth = (w >= 4 && w < 9) || // Feb-Mar
                (w >= 13 && w < 22) || // Apr-May
                (w >= 26 && w < 35) || // Jul-Aug
                (w >= 39 && w < 52);  // Oct-Dec

            const isStreak = w % 7 < 3 && d > 0 && d < 6; // Streaks regularly
            const isProjectPeriod = isActiveMonth && d > 0 && d < 6; // Project periods

            let contributionValue = 0;
            const rand = Math.random();

            if (isStreak && rand < 0.8) {
                contributionValue = Math.floor(Math.random() * 3) + 2; // 2-4 during streaks
            } else if (isProjectPeriod && rand < 0.7) {
                contributionValue = Math.floor(Math.random() * 3) + 1; // 1-3 during projects
            } else if (rand < baseProbability) {
                contributionValue = Math.floor(Math.random() * 2) + 1; // 1-2 normally
            }

            // If we're approaching our target contributions, reduce frequency
            if (totalContributions > 3800) {
                contributionValue = Math.random() < 0.2 ? contributionValue : 0;
            }

            totalContributions += contributionValue;
            weekData.push(contributionValue);
        }
        data.push(weekData);
    }

    // Default month labels if real data isn't fetched
    const defaultMonthLabels: MonthLabel[] = [
        { month: 'Jan', position: 2 },
        { month: 'Feb', position: 7.45 },
        { month: 'Mar', position: 12.9 },
        { month: 'Apr', position: 18.35 },
        { month: 'May', position: 23.8 },
        { month: 'Jun', position: 29.25 },
        { month: 'Jul', position: 34.7 },
        { month: 'Aug', position: 40.15 },
        { month: 'Sep', position: 45.6 },
        { month: 'Oct', position: 51.05 },
        { month: 'Nov', position: 56.5 },
        { month: 'Dec', position: 62 }
    ];

    return { data, totalContributions, monthLabels: defaultMonthLabels };
};

const getContributionColor = (value: number, energy: number, config: VisualizationConfig) => {
    // Define Saturation and Lightness maps for GitHub contribution levels
    // Index corresponds to 'value': 0 for no contribution, 1-4 for increasing contribution
    const GITHUB_S_MAP = [0, 71, 52, 55, 54]; // Saturation values
    const GITHUB_L_MAP = [93, 76, 51, 41, 28]; // Lightness values
    const MAX_GITHUB_LEVEL = GITHUB_S_MAP.length - 1;

    // Apply different color strategies based on color mode
    switch (config.colorMode) {
        case 'monochrome': {
            const baseHsl = hexToHSL(config.baseColor);
            const h_final = baseHsl.h;

            // Determine S and L based on the value, using the GitHub scale map
            const RENDER_VALUE = Math.min(Math.max(0, Math.floor(value)), MAX_GITHUB_LEVEL);
            const s_final = GITHUB_S_MAP[RENDER_VALUE];
            const l_final = GITHUB_L_MAP[RENDER_VALUE];

            // Apply energy effects
            const energyBoost = energy * 30;
            let enhancedSat = Math.min(100, s_final + energyBoost);

            // Adjust lightBoost calculation to be less aggressive for higher values,
            // and to work consistently with the new l_final
            // Original: energy * 6 * (1 - value * 0.15)
            // For value 0, l_final is high (93). We want energy to darken it.
            // For value 4, l_final is low (28). We want energy to potentially darken it a bit too.
            // Let's make lightBoost primarily dependent on energy, and scale it modestly.
            const lightBoostFactor = 0.5 + (RENDER_VALUE * 0.05); // Smaller reduction for higher values
            const lightBoost = energy * 15 * lightBoostFactor; // Increased base effect

            const enhancedLight = Math.max(10, Math.min(95, l_final - lightBoost)); // Clamped Lightness

            // If the original baseColor was greyscale (saturation 0), ensure the result is also greyscale.
            // This overrides any saturation from the GITHUB_S_MAP or energyBoost if baseHsl.s is 0.
            if (baseHsl.s === 0) {
                enhancedSat = 0;
            }

            return `hsl(${h_final}, ${enhancedSat}%, ${enhancedLight}%)`;
        }

        case 'spectrum': {
            const time = Date.now() * 0.001;
            const baseHue = (time * 30) % 360;

            if (value === 0) {
                // For no contribution, use a light grey color.
                // Hue doesn't matter when saturation is 0.
                const noContribS = GITHUB_S_MAP[0]; // Should be 0
                const noContribL = GITHUB_L_MAP[0]; // Should be 93

                // Allow a little energy effect on lightness for empty blocks
                const lightBoost = energy * 15 * 0.5; // Similar to monochrome's value=0 energy effect
                const enhancedLight = Math.max(10, Math.min(95, noContribL - lightBoost));

                return `hsl(${baseHue}, ${noContribS}%, ${enhancedLight}%)`;
            } else {
                // Existing logic for colored blocks (value > 0)
                const saturation = 70 + (value * 10);
                const lightness = 60 - (value * 12);

                // Apply energy effects
                const enhancedSat = Math.min(100, saturation + (energy * 30));
                const lightBoostForValue = energy * 6 * (1 - value * 0.15); // Original calculation for colored blocks
                const enhancedLight = Math.max(15, lightness - lightBoostForValue);

                return `hsl(${baseHue}, ${enhancedSat}%, ${enhancedLight}%)`;
            }
        }

        default: {
            const h = 140 - value * 2;
            const s = 50 + value * 15;
            const baseLight = 70 - value * 15;
            const energyBoost = energy * 30;
            const enhancedSat = Math.min(100, s + energyBoost);
            const lightBoost = energy * 6 * (1 - value * 0.15);
            const enhancedLight = Math.max(15, baseLight - lightBoost);

            return `hsl(${h}, ${enhancedSat}%, ${enhancedLight}%)`;
        }
    }
};

interface GitHubGridProps {
    audioData: AudioAnalysisData;
    config: VisualizationConfig;
    dimensions: { width: number; height: number };
    contributionData: number[][];
    monthLabels: MonthLabel[];
}

const GitHubGrid: React.FC<GitHubGridProps> = ({ audioData, config, dimensions, contributionData, monthLabels }) => {
    const { camera } = useThree();
    const gridRef = useRef<THREE.Group>(null);
    const textLabelsRef = useRef<THREE.Group>(null);
    const blockRefs = useRef<THREE.Mesh[][]>([]);

    // Set up camera initial position and aspect ratio
    useEffect(() => {
        // Update camera aspect ratio based on dimensions
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = dimensions.width / dimensions.height;
            camera.updateProjectionMatrix();
        }

        camera.position.set(26, 30, 45); // Zoomed out further
        camera.lookAt(26, 0, 0);
    }, [camera, dimensions.width, dimensions.height]);

    // Create GitHub contribution grid
    useEffect(() => {
        if (!gridRef.current) return;

        const weeks = contributionData.length;
        const days = contributionData[0]?.length || 7;
        const spacing = 1.3;
        const blockSize = 1;

        // Proper cleanup: remove any existing blocks
        if (blockRefs.current.length > 0) {
            // Flatten the 2D array of blocks and dispose of all geometries and materials
            blockRefs.current.flat().forEach(block => {
                if (block && block.geometry) block.geometry.dispose();
                if (block && block.material) {
                    if (Array.isArray(block.material)) {
                        block.material.forEach(mat => mat.dispose());
                    } else {
                        block.material.dispose();
                    }
                }
                if (block && block.parent) block.parent.remove(block);
            });
        }

        // Clear array reference
        blockRefs.current = [];

        // Create blocks for each day
        for (let w = 0; w < weeks; w++) {
            const weekBlocks = [];
            for (let d = 0; d < days; d++) {
                const value = contributionData[w][d];

                // Create block geometry
                const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

                // Create material with enhanced glossy/metallic properties
                const material = new THREE.MeshPhysicalMaterial({
                    color: getContributionColor(value, 0, config),
                    metalness: value === 0 ? 0.4 : 0.95, // Increased metalness for better reflections
                    roughness: value === 0 ? 0.3 : 0.08, // Reduced roughness for smoother, more mirror-like surface
                    clearcoat: value === 0 ? 0.3 : 0.9, // Increased clearcoat for extra glossy layer
                    clearcoatRoughness: value === 0 ? 0.4 : 0.05, // Smoother clearcoat surface
                    reflectivity: value === 0 ? 0.4 : 1.0, // Maximum reflectivity for colored blocks
                    envMapIntensity: 0.4,
                    ior: 2.5, // Higher index of refraction for more dramatic reflections
                    specularIntensity: value === 0 ? 0.2 : 1.0, // Add specular highlights
                    specularColor: new THREE.Color(0xffffff), // White specular for sharp highlights
                    emissive: value === 0 ? new THREE.Color(0x000000) : getContributionColor(value, 0, config),
                    emissiveIntensity: value === 0 ? 0 : 0.15
                });

                const block = new THREE.Mesh(geometry, material);

                // Position the block
                block.position.set(w * spacing, 0, d * spacing);

                // Store a unique ID to help with debugging
                block.userData.id = `block-${w}-${d}`;

                // Add block to the scene
                gridRef.current.add(block);
                weekBlocks.push(block);
            }
            blockRefs.current.push(weekBlocks);
        }

        // Return cleanup function
        return () => {
            if (!blockRefs.current) return;
            // Cleanup on unmount
            blockRefs.current.flat().forEach(block => {
                if (block && block.geometry) block.geometry.dispose();
                if (block && block.material) {
                    if (Array.isArray(block.material)) {
                        block.material.forEach(mat => mat.dispose());
                    } else {
                        block.material.dispose();
                    }
                }
                if (block && block.parent) block.parent.remove(block);
            });
        };
    }, [contributionData, config]);

    // Animate GitHub contribution grid
    useFrame((state) => {
        if (!gridRef.current) return;

        const time = state.clock.getElapsedTime();
        const { bassEnergy, midEnergy, highEnergy } = audioData;
        const enhancedSensitivity = config.sensitivity * 1.5;

        // Grid rotation is subtle and independent of motion intensity
        // to maintain GitHub style and not cause motion sickness
        gridRef.current.rotation.y = Math.sin(time * 0.1) * 0.02;
        gridRef.current.rotation.x = Math.sin(time * 0.15) * 0.01;

        // Update blocks based on audio features
        const weeks = contributionData.length;
        const days = contributionData[0]?.length || 7;

        for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < days; d++) {
                const block = blockRefs.current[w]?.[d];
                if (!block) continue;

                const value = contributionData[w][d];
                if (value === 0) continue; // Skip empty blocks

                // Determine which energy to use based on position
                // Use bass for weekends, mid for middle of week, high for end of week
                let energy = midEnergy;
                if (d < 2) energy = bassEnergy;
                else if (d > 4) energy = highEnergy;

                // Base height - all boxes start at the same height of 1 unit
                const baseHeight = 1;

                // Reference to store previous heights for smooth transitions
                block.userData.prevHeight = block.userData.prevHeight || baseHeight;

                // More responsive energy factor with steeper curve - now influenced by motion intensity
                const motionFactor = config.motionIntensity * 2.0; // Apply stronger motion intensity effect
                const energyFactor = Math.pow(energy * enhancedSensitivity * 1.5, 1.5);

                // Value factor - enhances distinction between different values during audio activity
                // Higher contribution values will respond more dramatically to audio
                const valueMultiplier = 0.3 + (value * 0.2); // 0.3 for value 0, up to 1.1 for value 4
                const valueFactor = 1 + (valueMultiplier * energyFactor * motionFactor);

                // Calculate new height - influenced by motion intensity and value only when audio is present
                const targetHeight = baseHeight * valueFactor;

                // Smooth transition with steep rise/fall - lerp with a variable alpha
                // Alpha is now influenced by motion intensity for more responsive transitions
                // Higher alpha when rising, lower alpha when falling for asymmetric response
                const rising = targetHeight > block.userData.prevHeight;
                const baseAlpha = rising ? 0.3 : 0.15;
                // More motion intensity = faster transitions
                const alpha = baseAlpha * (0.5 + config.motionIntensity * 0.8);
                const smoothHeight = THREE.MathUtils.lerp(block.userData.prevHeight, targetHeight, alpha);

                // Store current height for next frame
                block.userData.prevHeight = smoothHeight;

                // Set block scale (height)
                block.scale.y = smoothHeight;
                block.position.y = smoothHeight / 2 - 0.5;

                // Update block color and emissive intensity
                const material = block.material as THREE.MeshPhysicalMaterial;
                const color = getContributionColor(value, energy * enhancedSensitivity, config);
                material.color.set(color);

                // Only set emissive properties for non-empty blocks
                if (value === 0) {
                    material.emissive.set(0x000000);
                    material.emissiveIntensity = 0;
                } else {
                    material.emissive.set(color);
                    // Emissive intensity scaled by value to maintain distinction when audio is active
                    // Higher value blocks get more intense emissive glow
                    const valueScale = 0.7 + value * 0.3; // Scale from 1.0-1.9 based on value
                    material.emissiveIntensity = 0.15 + (energy * 0.5 * config.motionIntensity * valueScale);
                }
            }
        }
    });

    return (
        <>
            {/* Dynamic fog color based on audio frequencies */}
            <fog attach="fog" args={[
                new THREE.Color()
                    .setHSL(
                        0.65 + audioData.midEnergy * 0.05 * config.sensitivity,
                        0.06 + audioData.bassEnergy * 0.04 * config.sensitivity,
                        0.02 + audioData.highEnergy * 0.005 * config.sensitivity
                    )
                    .getStyle(),
                30,
                Math.max(100, dimensions.width / 10)
            ]} />
            <ambientLight intensity={0.3} />
            <hemisphereLight args={['#ffffff', '#000000', 0.3]} />
            <pointLight position={[26, 30, 10]} intensity={1.5} />
            <pointLight position={[0, 10, 20]} intensity={0.8} color="#9be9a8" />
            <pointLight position={[50, 20, 10]} intensity={0.8} color="#ffffff" />
            <directionalLight position={[-10, 20, 30]} intensity={0.6} />

            {/* User camera controls */}
            <OrbitControls
                target={new THREE.Vector3(26, 0, 0)}
                enableDamping={true}
                dampingFactor={0.05}
                rotateSpeed={0.5}
                minDistance={20}
                maxDistance={80}
                maxPolarAngle={Math.PI / 2}
            />

            {/* GitHub contribution grid with all associated elements grouped together */}
            <group ref={gridRef} position={[0, 0, 0]}>
                {/* Contribution blocks created in useEffect */}
                <spotLight
                    position={[20, 15, 15]}
                    angle={0.3}
                    penumbra={0.8}
                    intensity={1.2}
                    castShadow
                />
                {/* Additional light to create more reflective highlights */}
                <spotLight
                    position={[-15, 20, 5]}
                    angle={0.25}
                    penumbra={0.7}
                    intensity={0.8}
                    color="#ffffff"
                    castShadow
                />

                {/* Month labels positioned along the top edge, rotated */}
                <group position={[0, 0, -1.5]}>
                    {monthLabels.map((item) => (
                        <Text
                            key={`month-${item.month}`}
                            position={[item.position, 0, 0]}
                            fontSize={0.8}
                            color="#8b949e"
                            renderOrder={1}
                            rotation={[80, 0, 0]} // Rotated like weekdays
                            anchorY="bottom"
                        >
                            {item.month}
                        </Text>
                    ))}
                </group>

                {/* Legend positioned at the bottom right with matching rotation - now part of the grid */}
                <group position={[52, 0, 10]}>
                    <Text
                        position={[0.5, 0, 0]}
                        fontSize={0.8}
                        color="#8b949e"
                        anchorX="right"
                        renderOrder={1}
                        rotation={[80, 0, 0]}
                    >
                        Less
                    </Text>

                    {/* Color squares for legend - arranged horizontally */}
                    {[0, 1, 2, 3, 4].map((value, index) => (
                        <mesh
                            key={`legend-${value}`}
                            position={[index * 1.0 + 1.5, 0, 0]}
                            renderOrder={1}
                            rotation={[80, 0, 0]}
                        >
                            <planeGeometry args={[0.8, 0.8]} />
                            <meshBasicMaterial
                                color={getContributionColor(value, 0, config)}
                            />
                        </mesh>
                    ))}

                    <Text
                        position={[6.5, 0, 0]}
                        fontSize={0.8}
                        color="#8b949e"
                        anchorX="left"
                        renderOrder={1}
                        rotation={[80, 0, 0]}
                    >
                        More
                    </Text>
                </group>
            </group>

            {/* Day labels positioned at the left - will stay fixed relative to the camera */}
            <group ref={textLabelsRef}>
                {[
                    { day: 'Mon', position: 1 },
                    { day: 'Wed', position: 3 },
                    { day: 'Fri', position: 5 }
                ].map((item) => (
                    <Text
                        key={`day-${item.day}`}
                        position={[-1.5, 0, item.position * 1.2]}
                        fontSize={0.8}
                        color="#8b949e"
                        anchorX="right"
                        renderOrder={1}
                        rotation={[80, 0, 0]}
                    >
                        {item.day}
                    </Text>
                ))}
            </group>

            {/* Post-processing effects */}
            <Environment preset='forest' />
            <EffectComposer>
                <Bloom
                    intensity={0}
                    luminanceThreshold={0.2}
                    luminanceSmoothing={0.9}
                    height={300}
                />
            </EffectComposer>
        </>
    );
};

const GitHubPattern: React.FC<GitHubPatternProps> = ({
    audioData,
    config,
    dimensions,
}) => {
    const [username, setUsername] = useState<string>('');
    const initialData = useMemo(() => generateContributionData(), []);
    const [contributionData, setContributionData] = useState<number[][]>(initialData.data);
    const [monthLabels, setMonthLabels] = useState<MonthLabel[]>(initialData.monthLabels);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const parseSVGData = (svgText: string): { data: number[][]; labels: MonthLabel[] } => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

        const rects = Array.from(svgDoc.querySelectorAll("rect[data-date][data-score]"));
        if (rects.length === 0) {
            throw new Error("No contribution data found in SVG.");
        }

        // Map y-coordinates to day index (0=Sun, 1=Mon, ..., 6=Sat)
        // These values are from the example SVG. Adjust if they vary.
        const yToDayIndex: { [key: string]: number } = {
            "20": 0, // Sunday
            "32": 1, // Monday
            "44": 2, // Tuesday
            "56": 3, // Wednesday
            "68": 4, // Thursday
            "80": 5, // Friday
            "92": 6  // Saturday
        };

        // Get all unique x-coordinates for weeks and sort them
        const weekXCoords = [...new Set(rects.map(rect => parseFloat(rect.getAttribute("x")!)))].sort((a, b) => a - b);
        const numWeeks = weekXCoords.length;
        if (numWeeks === 0) {
            throw new Error("Could not determine week structure from SVG.");
        }

        const weekXMap: { [key: number]: number } = {};
        weekXCoords.forEach((x, index) => weekXMap[x] = index);

        const contributionData: number[][] = Array(numWeeks).fill(null).map(() => Array(7).fill(0));
        let totalContributions = 0;

        rects.forEach(rect => {
            const x = parseFloat(rect.getAttribute("x")!);
            const y = rect.getAttribute("y")!;
            const score = parseInt(rect.getAttribute("data-score")!, 10);
            // const fill = rect.style.fill; // Fallback if data-score is not present
            // const score = parseInt(rect.getAttribute("data-score")!, 10) || getScoreFromFill(fill);


            const weekIndex = weekXMap[x];
            const dayIndex = yToDayIndex[y];

            if (weekIndex !== undefined && dayIndex !== undefined) {
                contributionData[weekIndex][dayIndex] = score;
                totalContributions += score;
            }
        });

        console.log("Total contributions parsed:", totalContributions);


        // Parse month labels
        // In the example, month labels are <text> elements with y="10"
        const monthTextElements = Array.from(svgDoc.querySelectorAll("text")).filter(text => text.getAttribute("y") === "10");
        const parsedMonthLabels: MonthLabel[] = [];

        if (weekXCoords.length > 0) {
            const firstWeekX = weekXCoords[0];
            // Assuming consistent week column width, e.g., 12px from example (39-27)
            const svgWeekWidth = weekXCoords.length > 1 ? weekXCoords[1] - weekXCoords[0] : 12;
            const sceneSpacing = 1.3; // Matches GitHubGrid spacing

            monthTextElements.forEach(textElement => {
                const monthName = textElement.textContent || "Unknown";
                const svgX = parseFloat(textElement.getAttribute("x")!);

                // Calculate position relative to the start of the grid in scene units
                const relativeSvgWeeks = (svgX - firstWeekX) / svgWeekWidth;
                const scenePosition = relativeSvgWeeks * sceneSpacing + (sceneSpacing / 2);

                parsedMonthLabels.push({ month: monthName, position: scenePosition });
            });
        }

        return { data: contributionData, labels: parsedMonthLabels };
    };

    const fetchGitHubData = async (user: string) => {
        if (!user) {
            showCustomToast({ title: "Input Required", description: "Please enter a GitHub username.", type: 'warning' });
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`/api/ghcontributions/${user}`);
            if (!response.ok) {
                if (response.status === 404) {
                    showCustomToast({ title: "Error Fetching Data", description: `User "${user}" not found or no contribution data.`, type: 'error' });
                } else {
                    showCustomToast({
                        title: "Error Fetching Data", description: `Failed to fetch data for ${user}.`, type: 'error'
                    });
                }
                setContributionData(initialData.data);
                setMonthLabels(initialData.monthLabels);
                setIsLoading(false);
                return;
            }
            const svgText = await response.text();

            if (!svgText.includes("<svg")) {
                showCustomToast({ title: "Invalid Data", description: "Fetched data does not appear to be a valid SVG.", type: 'error' });
                setContributionData(initialData.data);
                setMonthLabels(initialData.monthLabels);
                setIsLoading(false);
                return;
            }

            const { data, labels } = parseSVGData(svgText);
            setContributionData(data);
            if (labels && labels.length > 0) {
                setMonthLabels(labels);
            } else {
                setMonthLabels(initialData.monthLabels);
            }
            showCustomToast({ title: "Success!", description: `Loaded contribution data for ${user}!`, type: 'success' });
        } catch (err) {
            console.error("Error in fetchGitHubData or parseSVGData:", err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            if (!(err instanceof Error && (err.message.includes("not found") || err.message.includes("Failed to fetch data") || err.message.includes("valid SVG")))) {
                showCustomToast({ title: "Operation Failed", description: errorMessage, type: 'error' });
            }
            setContributionData(initialData.data);
            setMonthLabels(initialData.monthLabels);
        } finally {
            setIsLoading(false);
        }
    };

  const toasterPosition = document.documentElement.clientWidth >= 1024 ? 'bottom-right' : 'top-center';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-zinc-900 to-black/70"
          onClick={e => e.stopPropagation()}
               
        >
            <Toaster position={toasterPosition} />
            {/* Minimal input field and icon button */}
           <div
                onDoubleClick={e => e.stopPropagation()}
                className={`
                group absolute top-2 right-2 md:left-4 md:top-4 md:right-auto z-10 rounded-lg shadow-xl
hover:ring-1 hover:ring-zinc-600 hover:ring-offset-1 hover:ring-offset-black/50
                focus-within:ring-1 focus-within:ring-zinc-600 focus-within:ring-offset-1 focus-within:ring-offset-black/50
                ${isLoading
                        ? 'p-0 bg-transparent' // As per your example
                        : ''
                    }
              `}
            >
                {isLoading && (
                    <div className="absolute -inset-[1px] rounded-lg animate-pulse bg-[conic-gradient(from_90deg_at_50%_50%,#a78bfa_0%,#ec4899_50%,#f59e0b_100%)]"></div>
                )}
                <div
                    className={`
                  relative flex items-center w-full h-full hover:bg-zinc-800 focus-within:bg-zinc-800 backdrop-blur-sm rounded-lg py-1
                `}
                >
                    <svg height="28" aria-hidden="true" viewBox="0 0 24 24" version="1.1" width="32" data-view-component="true" className="octicon octicon-mark-github v-align-middle ml-2 text-zinc-300" fill="currentColor">
                        <path d="M12 1C5.9225 1 1 5.9225 1 12C1 16.8675 4.14875 20.9787 8.52125 22.4362C9.07125 22.5325 9.2775 22.2025 9.2775 21.9137C9.2775 21.6525 9.26375 20.7862 9.26375 19.865C6.5 20.3737 5.785 19.1912 5.565 18.5725C5.44125 18.2562 4.905 17.28 4.4375 17.0187C4.0525 16.8125 3.5025 16.3037 4.42375 16.29C5.29 16.2762 5.90875 17.0875 6.115 17.4175C7.105 19.0812 8.68625 18.6137 9.31875 18.325C9.415 17.61 9.70375 17.1287 10.02 16.8537C7.5725 16.5787 5.015 15.63 5.015 11.4225C5.015 10.2262 5.44125 9.23625 6.1425 8.46625C6.0325 8.19125 5.6475 7.06375 6.2525 5.55125C6.2525 5.55125 7.17375 5.2625 9.2775 6.67875C10.1575 6.43125 11.0925 6.3075 12.0275 6.3075C12.9625 6.3075 13.8975 6.43125 14.7775 6.67875C16.8813 5.24875 17.8025 5.55125 17.8025 5.55125C18.4075 7.06375 18.0225 8.19125 17.9125 8.46625C18.6138 9.23625 19.04 10.2125 19.04 11.4225C19.04 15.6437 16.4688 16.5787 14.0213 16.8537C14.42 17.1975 14.7638 17.8575 14.7638 18.8887C14.7638 20.36 14.75 21.5425 14.75 21.9137C14.75 22.2025 14.9563 22.5462 15.5063 22.4362C19.8513 20.9787 23 16.8537 23 12C23 5.9225 18.0775 1 12 1Z"></path>
                    </svg>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                        className="flex-grow px-2 w-28 md:w-36 bg-transparent text-white truncate focus:outline-none rounded-md placeholder-zinc-400"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchGitHubData(username); }}
                    />
                </div>
            </div>

            <Canvas
                style={{ width: dimensions.width, height: dimensions.height }}
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <GitHubGrid
                    audioData={audioData}
                    config={config}
                    dimensions={dimensions}
                    contributionData={contributionData}
                    monthLabels={monthLabels}
                />
            </Canvas>
        </motion.div>
    );
};

export default GitHubPattern; 