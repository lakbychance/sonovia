import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { getColorFromEnergy } from '../../utils/colorUtils';
import clsx from 'clsx';

interface BeatJumperPatternProps {
    audioData: AudioAnalysisData;
    dimensions: { width: number; height: number };
    config: VisualizationConfig;
    showControls?: boolean;
}

// Trail renderer class for creating light trails
class TrailRenderer {
    scene: THREE.Scene;
    numPoints: number;
    points: THREE.Vector3[];
    currentIndex: number;
    activePoints: number;
    line: THREE.Line;
    headPosition: THREE.Vector3;

    constructor(scene: THREE.Scene, numPoints = 200, color = 0xffffff, lineWidth = 1) {
        this.scene = scene;
        this.numPoints = numPoints;
        this.points = [];

        for (let i = 0; i < numPoints; i++) {
            this.points.push(new THREE.Vector3());
        }

        this.currentIndex = 0;
        this.activePoints = 0;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(numPoints * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: color,
            linewidth: lineWidth,
            opacity: 1,
            transparent: true
        });

        this.line = new THREE.Line(geometry, material);
        this.line.frustumCulled = false;
        this.scene.add(this.line);

        this.headPosition = new THREE.Vector3();
    }

    advance(newPosition: THREE.Vector3) {
        this.headPosition.copy(newPosition);
        this.points[this.currentIndex].copy(newPosition);
        this.currentIndex = (this.currentIndex + 1) % this.numPoints;

        if (this.activePoints < this.numPoints) {
            this.activePoints++;
        }

        this.updateGeometry();
    }

    updateGeometry() {
        const positions = this.line.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < this.activePoints; i++) {
            const pointIndex = (this.currentIndex - 1 - i + this.numPoints) % this.numPoints;
            positions[i * 3] = this.points[pointIndex].x;
            positions[i * 3 + 1] = this.points[pointIndex].y;
            positions[i * 3 + 2] = this.points[pointIndex].z;
        }

        // Hide remaining points
        for (let i = this.activePoints; i < this.numPoints; i++) {
            positions[i * 3] = this.headPosition.x;
            positions[i * 3 + 1] = this.headPosition.y;
            positions[i * 3 + 2] = this.headPosition.z;
        }

        this.line.geometry.setDrawRange(0, this.activePoints);
        this.line.geometry.attributes.position.needsUpdate = true;
    }

    setColor(color: number) {
        (this.line.material as THREE.LineBasicMaterial).color.set(color);
    }

    setOpacity(opacity: number) {
        (this.line.material as THREE.LineBasicMaterial).opacity = opacity;
    }

    reset() {
        this.activePoints = 0;
        this.currentIndex = 0;

        for (let i = 0; i < this.numPoints; i++) {
            this.points[i].set(0, 0, -1000); // Move offscreen
        }

        this.updateGeometry();
    }
}

const BeatJumperPattern: React.FC<BeatJumperPatternProps> = ({
    audioData,
    dimensions,
    config,
    showControls,
}) => {
    const { bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastBeatTimeRef = useRef<number>(0);

    // Color refs
    const color1Ref = useRef<THREE.Color>(new THREE.Color(0xff00ff));
    const color2Ref = useRef<THREE.Color>(new THREE.Color(0x00ffff));

    // Track objects references
    const trail1Ref = useRef<TrailRenderer | null>(null);
    const trail2Ref = useRef<TrailRenderer | null>(null);
    const lightBall1Ref = useRef<THREE.Mesh | null>(null);
    const lightBall2Ref = useRef<THREE.Mesh | null>(null);
    const platformsRef = useRef<Array<{
        mesh: THREE.Mesh;
        creationTime: number;
        isForTrail1: boolean;
        targetIntensity: number;
        currentIntensity: number;
        isLanded: boolean;
        landingProgress?: number; // For landing animation
        initialY?: number;      // For landing animation
    }>>([]);

    // Animation states
    const isJumping1Ref = useRef<boolean>(false);
    const isJumping2Ref = useRef<boolean>(false);
    const jumpProgress1Ref = useRef<number>(0);
    const jumpProgress2Ref = useRef<number>(0);
    const startPos1Ref = useRef<THREE.Vector3>(new THREE.Vector3());
    const startPos2Ref = useRef<THREE.Vector3>(new THREE.Vector3());
    const targetPos1Ref = useRef<THREE.Vector3>(new THREE.Vector3());
    const targetPos2Ref = useRef<THREE.Vector3>(new THREE.Vector3());
    const clockRef = useRef<THREE.Clock>(new THREE.Clock());
    const nextTrailToJumpRef = useRef<number>(0);
    const currentCameraZOffsetRef = useRef<number>(15); // Initialize with base offset

    // Lane Switching State
    const isLaneSwitchingRef = useRef<boolean>(false);
    const laneSwitchProgressRef = useRef<number>(0);
    const lastLaneSwitchTimeRef = useRef<number>(0);

    // Environment constants
    const corridorWidth = 20;
    // const jumpHeight = 3; // Base jump height - Now dynamic
    // const jumpDuration = 0.3; // Base jump duration - Now dynamic
    const beatThreshold = 0.3; // Lowered for more sensitivity (was 0.7, then 0.45 is fine)
    const minBeatInterval = 0.1;
    const platformSize = new THREE.Vector3(1.5, 0.5, 1.5);
    const maxPlatforms = 10;
    const lightBallRadius = 0.3;
    const platformLandAnimationDuration = 0.3; // seconds

    // Lane Switching Configuration
    // const LANE_SWITCH_DURATION = 0.7; // OLD: Duration of the lane switch jump - NOW DYNAMIC (dynamicLaneSwitchDuration)
    const MIN_LANE_SWITCH_INTERVAL = 8.0; // Minimum seconds between switches
    const LANE_SWITCH_AUDIO_THRESHOLD_BASS = 0.75; // Example threshold
    const LANE_SWITCH_AUDIO_THRESHOLD_MID = 0.275;  // Adjusted from 0.55 to account for dampenedMidEnergy

    // Camera Z Offset Configuration
    const BASE_CAMERA_Z_OFFSET = 15.0;
    const MAX_CAMERA_Z_OFFSET_DEVIATION = 6.0; // Max deviation from base (e.g., range 9 to 21)
    const CAMERA_OFFSET_LERP_SPEED = 0.03; // Speed of smooth interpolation for camera Z offset

    // Height Calculation Constants for Dynamic Jump Height
    const MIN_JUMP_HEIGHT_BASE = 1.5;
    const MAX_HEIGHT_ADDITION_FACTOR = 2.5; // Max height added by low energy, before sensitivity
    const HEIGHT_ENERGY_POWER_CURVE = 2.0;  // Power for inverse energy effect on height
    const BEAT_HEIGHT_BOOST_FACTOR = 0.3;   // Additive boost on beat
    const NORMALIZATION_DIVISOR_MID_HIGH = 1.5; // To normalize sum of mid+high energy towards 0-1 range

    // Easing function: easeInOutCubic
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Effect to handle dimension changes
    useEffect(() => {
        if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;

        // Store current camera position
        const currentPosition = cameraRef.current.position.clone();
        const currentLookAt = new THREE.Vector3(0, 1, currentPosition.z - 10);

        // Update renderer and composer dimensions
        cameraRef.current.aspect = dimensions.width / dimensions.height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(dimensions.width, dimensions.height);
        composerRef.current.setSize(dimensions.width, dimensions.height);

        // Restore camera position
        cameraRef.current.position.copy(currentPosition);
        cameraRef.current.lookAt(currentLookAt);
    }, [dimensions.width, dimensions.height]);

    // Initialize Three.js scene
    useEffect(() => {
        if (!mountRef.current) return;

        // Store references to existing objects before rebuilding scene
        const previousLightBall1Position = lightBall1Ref.current ? lightBall1Ref.current.position.clone() : null;
        const previousLightBall2Position = lightBall2Ref.current ? lightBall2Ref.current.position.clone() : null;
        const previousPlatforms = [...platformsRef.current];

        // Scene
        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x000000, 5, 80);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 1000);
        // Store the current position if we have one during re-initialization
        if (cameraRef.current) {
            camera.position.copy(cameraRef.current.position);
            camera.lookAt(0, 1, camera.position.z - 10);
        } else {
            camera.position.set(0, 3, 10);
            camera.lookAt(0, 1, 0);
        }
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(dimensions.width, dimensions.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ReinhardToneMapping;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Post-processing (Bloom)
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(dimensions.width, dimensions.height),
            1.0, // Strength
            0.2, // Radius
            0.1  // Threshold
        );
        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composerRef.current = composer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        scene.add(ambientLight);

        // Floor
        const floorGeometry = new THREE.PlaneGeometry(corridorWidth * 2, corridorWidth * 8);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.2,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -platformSize.y / 2;
        scene.add(floor);

        // Light Balls
        const ballGeometry = new THREE.SphereGeometry(lightBallRadius, 16, 16);

        const material1 = new THREE.MeshStandardMaterial({
            color: color1Ref.current,
            emissive: color1Ref.current,
            emissiveIntensity: 2
        });
        const lightBall1 = new THREE.Mesh(ballGeometry, material1);
        // Use previous position if available
        if (previousLightBall1Position) {
            lightBall1.position.copy(previousLightBall1Position);
        } else {
            lightBall1.position.set(-corridorWidth / 6, lightBallRadius, 0);
        }
        scene.add(lightBall1);
        lightBall1Ref.current = lightBall1;

        const light1 = new THREE.PointLight(color1Ref.current, 5, 5, 1);
        lightBall1.add(light1);

        const material2 = new THREE.MeshStandardMaterial({
            color: color2Ref.current,
            emissive: color2Ref.current,
            emissiveIntensity: 2
        });
        const lightBall2 = new THREE.Mesh(ballGeometry, material2);
        // Use previous position if available
        if (previousLightBall2Position) {
            lightBall2.position.copy(previousLightBall2Position);
        } else {
            lightBall2.position.set(corridorWidth / 6, lightBallRadius, 0);
        }
        scene.add(lightBall2);
        lightBall2Ref.current = lightBall2;

        const light2 = new THREE.PointLight(color2Ref.current, 5, 5, 1);
        lightBall2.add(light2);

        // Trails
        const trail1 = new TrailRenderer(scene, 100, color1Ref.current.getHex(), 2);
        const trail2 = new TrailRenderer(scene, 100, color2Ref.current.getHex(), 2);
        trail1.advance(lightBall1.position);
        trail2.advance(lightBall2.position);
        trail1Ref.current = trail1;
        trail2Ref.current = trail2;

        // Recreate platforms from previous state if available
        platformsRef.current = [];
        if (previousPlatforms.length > 0) {
            previousPlatforms.forEach(prevPlatform => {
                const platformObj = spawnPlatform(
                    prevPlatform.mesh.position.x,
                    prevPlatform.mesh.position.z,
                    prevPlatform.isForTrail1
                );
                if (platformObj) {
                    platformObj.isLanded = prevPlatform.isLanded;
                    platformObj.currentIntensity = prevPlatform.currentIntensity;
                    platformObj.targetIntensity = prevPlatform.targetIntensity;

                    if (platformObj.mesh.material instanceof THREE.MeshStandardMaterial) {
                        platformObj.mesh.material.emissiveIntensity = platformObj.currentIntensity;
                    }
                }
            });
        } else {
            // Initial Platforms if no previous state
            spawnPlatform(lightBall1.position.x, lightBall1.position.z - platformSize.z * 2, true);
            spawnPlatform(lightBall2.position.x, lightBall2.position.z - platformSize.z * 2, false);
        }

        // Preserve jump states
        if (previousLightBall1Position && previousLightBall2Position) {
            // Keep animation states intact
            if (isJumping1Ref.current && startPos1Ref.current && targetPos1Ref.current) {
                // Re-establish proper start/target positions for ongoing jumps
                startPos1Ref.current = previousLightBall1Position.clone();
                // Calculate new target position based on progress
                if (jumpProgress1Ref.current < 1) {
                    const progress = jumpProgress1Ref.current;
                    // Adjust Y position based on jump height and progress
                    // Use a placeholder or average jump height here for accurate repositioning if dynamicJumpHeight isn't available
                    // Or, ideally, this logic should be re-evaluated as dynamicJumpHeight is calculated per frame.
                    // For now, let's use a base value to avoid breaking the repositioning logic.
                    const estimatedJumpHeightForReposition = 2.5; // Average/base value
                    const yOffset = Math.sin(progress * Math.PI) * estimatedJumpHeightForReposition;
                    lightBall1.position.y = previousLightBall1Position.y - yOffset +
                        Math.sin(progress * Math.PI) * estimatedJumpHeightForReposition;
                }
            }

            if (isJumping2Ref.current && startPos2Ref.current && targetPos2Ref.current) {
                // Re-establish proper start/target positions for ongoing jumps
                startPos2Ref.current = previousLightBall2Position.clone();
                // Calculate new target position based on progress
                if (jumpProgress2Ref.current < 1) {
                    const progress = jumpProgress2Ref.current;
                    const estimatedJumpHeightForReposition = 2.5; // Average/base value
                    const yOffset = Math.sin(progress * Math.PI) * estimatedJumpHeightForReposition;
                    lightBall2.position.y = previousLightBall2Position.y - yOffset +
                        Math.sin(progress * Math.PI) * estimatedJumpHeightForReposition;
                }
            }
        } else {
            // Reset animation states if starting fresh
            isJumping1Ref.current = false;
            isJumping2Ref.current = false;
            jumpProgress1Ref.current = 0;
            jumpProgress2Ref.current = 0;
        }

        // Cleanup on unmount
        return () => {
            if (rendererRef.current && mountRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement);
            }
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            // Dispose of Three.js resources
            disposeThreeJsResources();
        };
    }, [dimensions.width, dimensions.height]);

    // Dispose of Three.js resources
    const disposeThreeJsResources = () => {
        if (sceneRef.current) {
            sceneRef.current.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }
    };

    // Spawn platform
    const spawnPlatform = (x: number, z: number, isForTrail1: boolean) => {
        if (!sceneRef.current) return null;

        const platformGeometry = new THREE.BoxGeometry(platformSize.x, platformSize.y, platformSize.z);

        const ballColor = isForTrail1 ? color1Ref.current : color2Ref.current;
        const platformEmissiveColor = ballColor
            ? new THREE.Color(ballColor).multiplyScalar(0.6)
            : new THREE.Color(isForTrail1 ? 0xee00ee : 0x00eeee); // Fallback to old logic if ref not ready

        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, // Keep base color white or derive if needed
            emissive: platformEmissiveColor,
            emissiveIntensity: 0.3,
            roughness: 0.8,
            metalness: 0.3
        });

        const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
        platformMesh.position.set(x, 0, z);
        sceneRef.current.add(platformMesh);

        const platformObj = {
            mesh: platformMesh,
            creationTime: performance.now() / 1000,
            isForTrail1: isForTrail1,
            targetIntensity: 1.2,
            currentIntensity: 0.3,
            isLanded: false,
            landingProgress: undefined,
            initialY: undefined
        };

        platformsRef.current.push(platformObj);

        // Prune old platforms
        const platformArray = isForTrail1
            ? platformsRef.current.filter(p => p.isForTrail1)
            : platformsRef.current.filter(p => !p.isForTrail1);

        if (platformArray.length > maxPlatforms) {
            const oldPlatform = platformsRef.current.find(p => p.mesh === platformArray[0].mesh);
            if (oldPlatform && sceneRef.current) {
                sceneRef.current.remove(oldPlatform.mesh);
                oldPlatform.mesh.geometry.dispose();
                if (oldPlatform.mesh.material instanceof THREE.Material) {
                    oldPlatform.mesh.material.dispose();
                }
                platformsRef.current = platformsRef.current.filter(p => p !== oldPlatform);
            }
        }

        return platformObj;
    };

    // Update platforms
    const updatePlatforms = (deltaTime: number) => {
        const currentTime = performance.now() / 1000;

        platformsRef.current.forEach((p, index) => {
            // Landing animation
            if (p.isLanded && p.landingProgress !== undefined && p.initialY !== undefined) {
                p.landingProgress += deltaTime / platformLandAnimationDuration;
                if (p.landingProgress >= 1) {
                    p.landingProgress = 1;
                    p.mesh.position.y = p.initialY;
                    // Optionally, mark animation as complete if needed, e.g., p.landingProgress = undefined;
                } else {
                    // Simple bounce: dip then return
                    const bounceProgress = Math.sin(p.landingProgress * Math.PI);
                    p.mesh.position.y = p.initialY - bounceProgress * 0.2; // Adjust bounce height (0.2)
                }
            }

            if (p.isLanded && p.currentIntensity < p.targetIntensity) {
                p.currentIntensity += 5 * deltaTime; // Fast glow up
                p.currentIntensity = Math.min(p.currentIntensity, p.targetIntensity);
            } else if (!p.isLanded && p.currentIntensity > 0.1) {
                p.currentIntensity -= 0.5 * deltaTime;
                p.currentIntensity = Math.max(p.currentIntensity, 0.1);
            }

            if (p.mesh.material instanceof THREE.MeshStandardMaterial) {
                p.mesh.material.emissiveIntensity = p.currentIntensity;
            }

            // Fade out old platforms
            if (currentTime - p.creationTime > 10 || p.mesh.position.z > cameraRef.current!.position.z + 10) {
                if (p.mesh.material instanceof THREE.Material) {
                    p.mesh.material.transparent = true;
                    p.mesh.material.opacity -= 2 * deltaTime;

                    if (p.mesh.material.opacity <= 0 && sceneRef.current) {
                        sceneRef.current.remove(p.mesh);
                        p.mesh.geometry.dispose();
                        if (p.mesh.material instanceof THREE.Material) {
                            p.mesh.material.dispose();
                        }
                        platformsRef.current = platformsRef.current.filter((_, i) => i !== index);
                    }
                }
            }
        });
    };

    // Animation loop
    useEffect(() => {
        if (!isPlaying) {
            // Cancel any existing animation frame if music is paused or stopped
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        // Cancel any existing animation frame to prevent duplicates when dependencies change
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // DO NOT reset the clock here: clockRef.current.start();
        // The clock is auto-started on creation and getDelta() will handle varying frame times.
        // Resetting it here causes deltaTime to be near zero after a resize, leading to slow catch-up.

        const animate = () => {
            if (!sceneRef.current || !cameraRef.current || !composerRef.current ||
                !lightBall1Ref.current || !lightBall2Ref.current ||
                !trail1Ref.current || !trail2Ref.current) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const deltaTime = clockRef.current.getDelta();

            // Dampen mid-energy to reduce reactivity to vocals
            const dampenedMidEnergy = midEnergy * 0.5;

            // --- Color Updates ---
            const baseColorStr = getColorFromEnergy(bassEnergy, dampenedMidEnergy, highEnergy, config.colorMode, config.baseColor);
            const initialPrimaryColor = new THREE.Color(baseColorStr); // Color from utility

            // Apply pastel effect to primaryColor (for ball 1)
            const hsl1 = { h: 0, s: 0, l: 0 };
            initialPrimaryColor.getHSL(hsl1);
            hsl1.s = Math.max(0.4, Math.min(hsl1.s * 0.85, 0.70)); // Adjusted saturation: Further boosted multiplier and upper clamp
            hsl1.l = Math.min(0.85, Math.max(hsl1.l * 1.1, 0.7));   // Increase lightness, clamp to pastel range
            color1Ref.current.setHSL(hsl1.h, hsl1.s, hsl1.l);

            // Derive secondary color (for ball 2) and apply pastel effect
            const hsl2 = { h: 0, s: 0, l: 0 };
            initialPrimaryColor.getHSL(hsl2); // Start from the same initial color for hue base
            hsl2.h = (hsl2.h + 0.33) % 1.0; // Shift hue (approx 120 degrees)
            // Apply similar pastel saturation & lightness adjustments as for ball 1
            hsl2.s = Math.max(0.4, Math.min(hsl2.s * 0.85, 0.70)); // Adjusted saturation: Further boosted multiplier and upper clamp
            hsl2.l = Math.min(0.85, Math.max(hsl2.l * 1.1, 0.7));
            color2Ref.current.setHSL(hsl2.h, hsl2.s, hsl2.l);

            // Update existing ball materials, point lights, and trails if they exist
            if (lightBall1Ref.current) {
                if (lightBall1Ref.current.material instanceof THREE.MeshStandardMaterial) {
                    (lightBall1Ref.current.material as THREE.MeshStandardMaterial).color.copy(color1Ref.current);
                    (lightBall1Ref.current.material as THREE.MeshStandardMaterial).emissive.copy(color1Ref.current);
                }
                // Update PointLight color for ball 1
                const pointLight1 = lightBall1Ref.current.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight;
                if (pointLight1) {
                    pointLight1.color.copy(color1Ref.current);
                }
            }
            if (trail1Ref.current) {
                trail1Ref.current.setColor(color1Ref.current.getHex());
            }

            if (lightBall2Ref.current) {
                if (lightBall2Ref.current.material instanceof THREE.MeshStandardMaterial) {
                    (lightBall2Ref.current.material as THREE.MeshStandardMaterial).color.copy(color2Ref.current);
                    (lightBall2Ref.current.material as THREE.MeshStandardMaterial).emissive.copy(color2Ref.current);
                }
                // Update PointLight color for ball 2
                const pointLight2 = lightBall2Ref.current.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight;
                if (pointLight2) {
                    pointLight2.color.copy(color2Ref.current);
                }
            }
            if (trail2Ref.current) {
                trail2Ref.current.setColor(color2Ref.current.getHex());
            }
            // --- End Color Updates ---

            // --- Audio-reactive parameters ---
            const currentSensitivity = config.sensitivity * 1.5;
            const currentMotionIntensity = config.motionIntensity * 1.2;

            // Modulate Jump Height: Exponentially higher with low mid/high energy
            const normalizedMidHighEnergy = Math.min(1.0, (dampenedMidEnergy + highEnergy) / NORMALIZATION_DIVISOR_MID_HIGH);
            const lowEnergyMetric = 1.0 - normalizedMidHighEnergy;
            const curvedLowEnergyContribution = Math.pow(lowEnergyMetric, HEIGHT_ENERGY_POWER_CURVE);

            let dynamicJumpHeight = MIN_JUMP_HEIGHT_BASE +
                curvedLowEnergyContribution * MAX_HEIGHT_ADDITION_FACTOR * currentSensitivity;
            if (beat) {
                dynamicJumpHeight += BEAT_HEIGHT_BOOST_FACTOR * currentSensitivity;
            }
            dynamicJumpHeight = Math.max(0.4, Math.min(dynamicJumpHeight, 3.8)); // Final clamp, max allows for beat boost

            // Modulate Jump Duration for Normal Jumps: Slower base, significantly shortened by mid/high energy
            let dynamicJumpDuration = 0.60 - ((dampenedMidEnergy + highEnergy) * 0.30 * currentSensitivity);
            dynamicJumpDuration = Math.max(0.10, Math.min(dynamicJumpDuration, 0.70)); // Adjusted clamping for wider range

            // Modulate Jump Duration for Lane Switches:
            let dynamicLaneSwitchDuration = 0.70 - ((dampenedMidEnergy + highEnergy) * 0.28 * currentSensitivity);
            dynamicLaneSwitchDuration = Math.max(0.20, Math.min(dynamicLaneSwitchDuration, 0.85)); // Adjusted clamping for wider range

            // Modulate Camera Lerp Factor for Z-axis following speed
            let dynamicCameraLerp = 0.03 + (dampenedMidEnergy * 0.04 * currentMotionIntensity);
            dynamicCameraLerp = Math.max(0.02, Math.min(dynamicCameraLerp, 0.08));

            // Calculate Target Dynamic Camera Z Offset
            const overallEnergy = (bassEnergy + dampenedMidEnergy + highEnergy) / 8;
            let targetDynamicCameraZOffset = BASE_CAMERA_Z_OFFSET - (overallEnergy - 0.3) * MAX_CAMERA_Z_OFFSET_DEVIATION * 2.5;
            // When overallEnergy is low (e.g. 0.1), offset increases: 15 - (0.1-0.3)*D*2.5 = 15 - (-0.2)*D*2.5 = 15 + 0.5*D
            // When overallEnergy is high (e.g. 0.7), offset decreases: 15 - (0.7-0.3)*D*2.5 = 15 - (0.4)*D*2.5 = 15 - 1.0*D
            targetDynamicCameraZOffset = Math.max(
                BASE_CAMERA_Z_OFFSET - MAX_CAMERA_Z_OFFSET_DEVIATION,
                Math.min(targetDynamicCameraZOffset, BASE_CAMERA_Z_OFFSET + MAX_CAMERA_Z_OFFSET_DEVIATION)
            );
            // Smoothly interpolate the actual camera Z offset
            currentCameraZOffsetRef.current = THREE.MathUtils.lerp(
                currentCameraZOffsetRef.current,
                targetDynamicCameraZOffset,
                CAMERA_OFFSET_LERP_SPEED
            );

            // --- End Audio-reactive parameters ---

            const currentTime = performance.now() / 1000; // Get current time once

            // --- Lane Switch Logic ---
            if (!isJumping1Ref.current && !isJumping2Ref.current && !isLaneSwitchingRef.current &&
                (currentTime - lastLaneSwitchTimeRef.current) > MIN_LANE_SWITCH_INTERVAL &&
                bassEnergy > LANE_SWITCH_AUDIO_THRESHOLD_BASS && dampenedMidEnergy > LANE_SWITCH_AUDIO_THRESHOLD_MID
            ) {
                isLaneSwitchingRef.current = true;
                laneSwitchProgressRef.current = 0;
                lastLaneSwitchTimeRef.current = currentTime;

                if (lightBall1Ref.current && lightBall2Ref.current) {
                    startPos1Ref.current = lightBall1Ref.current.position.clone();
                    startPos2Ref.current = lightBall2Ref.current.position.clone();

                    // Determine target X for each ball based on their CURRENT lane, targeting the OPPOSITE lane
                    let targetX1_Switch, targetX2_Switch;

                    // Target for lightBall1 (the one that started on the left)
                    if (lightBall1Ref.current.position.x < 0) { // If ball 1 is currently on the left
                        targetX1_Switch = corridorWidth / 6 + (Math.random() - 0.5) * (platformSize.x * 0.3); // Target right
                    } else { // If ball 1 is currently on the right
                        targetX1_Switch = -corridorWidth / 6 + (Math.random() - 0.5) * (platformSize.x * 0.3); // Target left
                    }

                    // Target for lightBall2 (the one that started on the right)
                    if (lightBall2Ref.current.position.x > 0) { // If ball 2 is currently on the right
                        targetX2_Switch = -corridorWidth / 6 + (Math.random() - 0.5) * (platformSize.x * 0.3); // Target left
                    } else { // If ball 2 is currently on the left
                        targetX2_Switch = corridorWidth / 6 + (Math.random() - 0.5) * (platformSize.x * 0.3); // Target right
                    }

                    // Dynamic Z offset for the switch jump platforms
                    const switchMidBassEnergyForZ = (bassEnergy + dampenedMidEnergy) / 2;
                    const switchCurvedEnergy = Math.pow(switchMidBassEnergyForZ, 2.4);
                    let switchTargetZFactor = 0.6 + switchCurvedEnergy * 4.5 * currentSensitivity;
                    switchTargetZFactor = Math.max(0.5, Math.min(switchTargetZFactor, 5.2)); // Adjusted clamp
                    let switchTargetZOffset = -platformSize.z * switchTargetZFactor;
                    switchTargetZOffset += (Math.random() - 0.5) * platformSize.z * 0.2; // Keep small random variation

                    const platform1_Switch = spawnPlatform(
                        targetX1_Switch,
                        lightBall1Ref.current.position.z + switchTargetZOffset,
                        true // Platform is for lightBall1
                    );
                    const platform2_Switch = spawnPlatform(
                        targetX2_Switch,
                        lightBall2Ref.current.position.z + switchTargetZOffset, // Both balls jump similar distance
                        false // Platform is for lightBall2
                    );

                    if (platform1_Switch) {
                        targetPos1Ref.current = platform1_Switch.mesh.position.clone().setY(lightBallRadius);
                        platform1_Switch.isLanded = false;
                        platformsRef.current.filter(p => p.isForTrail1 && p !== platform1_Switch).forEach(p => { p.isLanded = false; });
                    }
                    if (platform2_Switch) {
                        targetPos2Ref.current = platform2_Switch.mesh.position.clone().setY(lightBallRadius);
                        platform2_Switch.isLanded = false;
                        platformsRef.current.filter(p => !p.isForTrail1 && p !== platform2_Switch).forEach(p => { p.isLanded = false; });
                    }
                }
            }
            // --- End Lane Switch Initiation ---

            // --- Lane Switch Movement ---
            if (isLaneSwitchingRef.current && lightBall1Ref.current && lightBall2Ref.current && trail1Ref.current && trail2Ref.current) {
                laneSwitchProgressRef.current += deltaTime / dynamicLaneSwitchDuration; // Use dynamic duration
                const rawSwitchProgress = laneSwitchProgressRef.current;
                const easedSwitchProgress = easeInOutCubic(rawSwitchProgress);

                if (rawSwitchProgress >= 1) {
                    isLaneSwitchingRef.current = false;
                    lightBall1Ref.current.position.copy(targetPos1Ref.current);
                    lightBall2Ref.current.position.copy(targetPos2Ref.current);

                    // Landing animation for ball 1
                    const landedPlatform1 = platformsRef.current.find(
                        p => p.mesh.position.distanceTo(targetPos1Ref.current) < 0.1 && p.isForTrail1
                    );
                    if (landedPlatform1) {
                        landedPlatform1.isLanded = true;
                        landedPlatform1.landingProgress = 0;
                        landedPlatform1.initialY = landedPlatform1.mesh.position.y;
                    }
                    // Landing animation for ball 2
                    const landedPlatform2 = platformsRef.current.find(
                        p => p.mesh.position.distanceTo(targetPos2Ref.current) < 0.1 && !p.isForTrail1
                    );
                    if (landedPlatform2) {
                        landedPlatform2.isLanded = true;
                        landedPlatform2.landingProgress = 0;
                        landedPlatform2.initialY = landedPlatform2.mesh.position.y;
                    }
                    // Advance trails one last time to the final position
                    trail1Ref.current.advance(lightBall1Ref.current.position);
                    trail2Ref.current.advance(lightBall2Ref.current.position);

                } else {
                    // Ball 1 (starts left, targets right)
                    lightBall1Ref.current.position.x = THREE.MathUtils.lerp(startPos1Ref.current.x, targetPos1Ref.current.x, easedSwitchProgress);
                    lightBall1Ref.current.position.z = THREE.MathUtils.lerp(startPos1Ref.current.z, targetPos1Ref.current.z, easedSwitchProgress);
                    lightBall1Ref.current.position.y = startPos1Ref.current.y + Math.sin(rawSwitchProgress * Math.PI) * dynamicJumpHeight;
                    const trailPos1Switch = new THREE.Vector3(
                        THREE.MathUtils.lerp(startPos1Ref.current.x, targetPos1Ref.current.x, rawSwitchProgress),
                        lightBall1Ref.current.position.y,
                        THREE.MathUtils.lerp(startPos1Ref.current.z, targetPos1Ref.current.z, rawSwitchProgress)
                    );
                    trail1Ref.current.advance(trailPos1Switch);

                    // Ball 2 (starts right, targets left)
                    lightBall2Ref.current.position.x = THREE.MathUtils.lerp(startPos2Ref.current.x, targetPos2Ref.current.x, easedSwitchProgress);
                    lightBall2Ref.current.position.z = THREE.MathUtils.lerp(startPos2Ref.current.z, targetPos2Ref.current.z, easedSwitchProgress);
                    lightBall2Ref.current.position.y = startPos2Ref.current.y + Math.sin(rawSwitchProgress * Math.PI) * dynamicJumpHeight;
                    const trailPos2Switch = new THREE.Vector3(
                        THREE.MathUtils.lerp(startPos2Ref.current.x, targetPos2Ref.current.x, rawSwitchProgress),
                        lightBall2Ref.current.position.y,
                        THREE.MathUtils.lerp(startPos2Ref.current.z, targetPos2Ref.current.z, rawSwitchProgress)
                    );
                    trail2Ref.current.advance(trailPos2Switch);
                }
            }
            // --- End Lane Switch Movement ---

            // Beat detection (Normal Jumps)
            const bassLevel = bassEnergy;
            if (!isLaneSwitchingRef.current && !isJumping1Ref.current && !isJumping2Ref.current &&
                (bassLevel > beatThreshold || (beat && bassLevel > 0.3)) &&
                (currentTime - lastBeatTimeRef.current) > minBeatInterval
            ) {
                lastBeatTimeRef.current = currentTime;

                // Modulate Platform Z Offset for normal jumps
                const midBassEnergyForZ = (bassEnergy + dampenedMidEnergy) / 2;
                const curvedEnergy = Math.pow(midBassEnergyForZ, 2.7);
                let targetZFactor = 0.4 + curvedEnergy * 5.0 * currentSensitivity;
                targetZFactor = Math.max(0.2, Math.min(targetZFactor, 5.5)); // Adjusted clamp for wider exponential range
                let dynamicTargetZOffset = -platformSize.z * targetZFactor;
                dynamicTargetZOffset += (Math.random() - 0.5) * platformSize.z * 0.3; // Add a small random variation

                let targetX: number;
                let currentBallRef: React.MutableRefObject<THREE.Mesh | null>;
                let currentStartPosRef: React.MutableRefObject<THREE.Vector3>;
                let currentTargetPosRef: React.MutableRefObject<THREE.Vector3>;
                let currentIsJumpingRef: React.MutableRefObject<boolean>;
                let currentJumpProgressRef: React.MutableRefObject<number>;
                let platformIsForTrail1: boolean;

                if (nextTrailToJumpRef.current === 0) { // Ball 1's turn
                    currentBallRef = lightBall1Ref;
                    currentStartPosRef = startPos1Ref;
                    currentTargetPosRef = targetPos1Ref;
                    currentIsJumpingRef = isJumping1Ref;
                    currentJumpProgressRef = jumpProgress1Ref;
                    platformIsForTrail1 = true;
                    // Determine Ball 1's current lane to target a platform in that same lane
                    targetX = (currentBallRef.current!.position.x > 0 ? corridorWidth / 6 : -corridorWidth / 6) + (Math.random() - 0.5) * (platformSize.x * 0.5);
                    nextTrailToJumpRef.current = 1;
                } else { // Ball 2's turn
                    currentBallRef = lightBall2Ref;
                    currentStartPosRef = startPos2Ref;
                    currentTargetPosRef = targetPos2Ref;
                    currentIsJumpingRef = isJumping2Ref;
                    currentJumpProgressRef = jumpProgress2Ref;
                    platformIsForTrail1 = false;
                    // Determine Ball 2's current lane
                    targetX = (currentBallRef.current!.position.x > 0 ? corridorWidth / 6 : -corridorWidth / 6) + (Math.random() - 0.5) * (platformSize.x * 0.5);
                    nextTrailToJumpRef.current = 0;
                }

                if (currentBallRef.current && !currentIsJumpingRef.current) {
                    currentStartPosRef.current = currentBallRef.current.position.clone();
                    const newPlatform = spawnPlatform(
                        targetX,
                        currentBallRef.current.position.z + dynamicTargetZOffset,
                        platformIsForTrail1
                    );
                    if (newPlatform) {
                        currentTargetPosRef.current = newPlatform.mesh.position.clone().setY(lightBallRadius);
                        newPlatform.isLanded = false;
                        platformsRef.current.filter(p => p.isForTrail1 === platformIsForTrail1 && p !== newPlatform).forEach(p => { p.isLanded = false; });
                        currentIsJumpingRef.current = true;
                        currentJumpProgressRef.current = 0;
                    }
                }
            }

            // Update Jumps (Normal Jumps)
            // Ball 1 Normal Jump Update
            if (isJumping1Ref.current && !isLaneSwitchingRef.current && lightBall1Ref.current && trail1Ref.current) {
                jumpProgress1Ref.current += deltaTime / dynamicJumpDuration;

                if (jumpProgress1Ref.current >= 1) {
                    jumpProgress1Ref.current = 1;
                    isJumping1Ref.current = false;
                    lightBall1Ref.current.position.copy(targetPos1Ref.current);

                    const landedPlatform = platformsRef.current.find(
                        p => p.mesh.position.distanceTo(targetPos1Ref.current) < 0.1 && p.isForTrail1
                    );

                    if (landedPlatform) {
                        landedPlatform.isLanded = true;
                        landedPlatform.landingProgress = 0; // Start landing animation
                        landedPlatform.initialY = landedPlatform.mesh.position.y;
                    }

                } else {
                    const rawProgress = jumpProgress1Ref.current;
                    const easedProgress = easeInOutCubic(rawProgress); // Apply easing

                    // Ball position uses eased horizontal progress for inertia
                    lightBall1Ref.current.position.x = THREE.MathUtils.lerp(
                        startPos1Ref.current.x,
                        targetPos1Ref.current.x,
                        easedProgress // Use eased progress for ball's X
                    );
                    lightBall1Ref.current.position.z = THREE.MathUtils.lerp(
                        startPos1Ref.current.z,
                        targetPos1Ref.current.z,
                        easedProgress // Use eased progress for ball's Z
                    );
                    lightBall1Ref.current.position.y = startPos1Ref.current.y +
                        Math.sin(rawProgress * Math.PI) * dynamicJumpHeight; // Use raw progress for ball's Y (natural sine arc)

                    // Trail position uses raw horizontal progress for the original path feel
                    const trailPosition1 = new THREE.Vector3(
                        THREE.MathUtils.lerp(startPos1Ref.current.x, targetPos1Ref.current.x, rawProgress),
                        lightBall1Ref.current.position.y, // Y is the same as the ball
                        THREE.MathUtils.lerp(startPos1Ref.current.z, targetPos1Ref.current.z, rawProgress)
                    );
                    trail1Ref.current.advance(trailPosition1);
                }
            } else {
                // When not jumping, trail follows the ball directly
                trail1Ref.current.advance(lightBall1Ref.current.position);
            }

            // Ball 2 Normal Jump Update
            if (isJumping2Ref.current && !isLaneSwitchingRef.current && lightBall2Ref.current && trail2Ref.current) {
                jumpProgress2Ref.current += deltaTime / dynamicJumpDuration;

                if (jumpProgress2Ref.current >= 1) {
                    jumpProgress2Ref.current = 1;
                    isJumping2Ref.current = false;
                    lightBall2Ref.current.position.copy(targetPos2Ref.current);

                    const landedPlatform = platformsRef.current.find(
                        p => p.mesh.position.distanceTo(targetPos2Ref.current) < 0.1 && !p.isForTrail1
                    );

                    if (landedPlatform) {
                        landedPlatform.isLanded = true;
                        landedPlatform.landingProgress = 0; // Start landing animation
                        landedPlatform.initialY = landedPlatform.mesh.position.y;
                    }

                } else {
                    const rawProgress = jumpProgress2Ref.current;
                    const easedProgress = easeInOutCubic(rawProgress); // Apply easing

                    // Ball position uses eased horizontal progress for inertia
                    lightBall2Ref.current.position.x = THREE.MathUtils.lerp(
                        startPos2Ref.current.x,
                        targetPos2Ref.current.x,
                        easedProgress // Use eased progress for ball's X
                    );
                    lightBall2Ref.current.position.z = THREE.MathUtils.lerp(
                        startPos2Ref.current.z,
                        targetPos2Ref.current.z,
                        easedProgress // Use eased progress for ball's Z
                    );
                    lightBall2Ref.current.position.y = startPos2Ref.current.y +
                        Math.sin(rawProgress * Math.PI) * dynamicJumpHeight; // Use raw progress for ball's Y (natural sine arc)

                    // Trail position uses raw horizontal progress for the original path feel
                    const trailPosition2 = new THREE.Vector3(
                        THREE.MathUtils.lerp(startPos2Ref.current.x, targetPos2Ref.current.x, rawProgress),
                        lightBall2Ref.current.position.y, // Y is the same as the ball
                        THREE.MathUtils.lerp(startPos2Ref.current.z, targetPos2Ref.current.z, rawProgress)
                    );
                    trail2Ref.current.advance(trailPosition2);
                }
            } else {
                // When not jumping, trail follows the ball directly
                trail2Ref.current.advance(lightBall2Ref.current.position);
            }

            // Move camera
            if (lightBall1Ref.current && lightBall2Ref.current && cameraRef.current) {
                const averageZ = (lightBall1Ref.current.position.z + lightBall2Ref.current.position.z) / 2;
                cameraRef.current.position.z = THREE.MathUtils.lerp(
                    cameraRef.current.position.z,
                    averageZ + currentCameraZOffsetRef.current,
                    dynamicCameraLerp // Use dynamic lerp factor
                );
            }

            // Add linear forward movement for non-jumping balls
            if (lightBall1Ref.current && !isJumping1Ref.current) {
                const nonJumpingForwardSpeed = 0.5 * currentMotionIntensity; // Adjust speed as needed
                lightBall1Ref.current.position.z -= nonJumpingForwardSpeed * deltaTime;
            }
            if (lightBall2Ref.current && !isJumping2Ref.current) {
                const nonJumpingForwardSpeed = 0.5 * currentMotionIntensity; // Adjust speed as needed
                lightBall2Ref.current.position.z -= nonJumpingForwardSpeed * deltaTime;
            }

            // Update platforms
            updatePlatforms(deltaTime);

            // Apply sensitivity to effect intensity
            if (composerRef.current.passes.length > 1) {
                const bloomPass = composerRef.current.passes[1] as UnrealBloomPass;
                if (bloomPass && 'strength' in bloomPass) {
                    bloomPass.strength = 1.0 + bassEnergy * currentSensitivity;
                }
            }

            // Render
            composerRef.current.render();

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [
        isPlaying,
        bassEnergy,
        midEnergy,
        highEnergy,
        beat,
        config.sensitivity,
        config.motionIntensity,
        dimensions.width,
        dimensions.height
    ]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
        >
            <div className="w-full h-full relative"> {/* Parent for canvas and overlay */}
                <div
                    ref={mountRef}
                    className="w-full h-full"
                />
                {/* Attribution Text */}
                <a
                    href="https://x.com/majidmanzarpour/status/1922123239670563284"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={clsx("absolute top-2 right-2 lg:left-2 lg:right-auto text-xs text-white/90 p-2 rounded-xl z-10 bg-gradient-to-r from-black/10 via-zinc-900 to-white/10 border border-zinc-700/80 backdrop-blur-sm transition-all duration-400 hover:text-orange-500 hover:bg-gradient-to-r hover:from-orange-500/10 hover:via-orange-400/10 hover:to-orange-300/10 hover:border-orange-500/50",
                        showControls ? "opacity-100" : "opacity-0"
                    )}
                >
                    Adapted from @majidmanzarpour
                </a>
                {/* Bottom Faded Mask Overlay */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none"
                    style={{
                        // Adjust the height (h-1/3) and gradient stops as needed
                        // The from-black assumes your scene fog is black or very dark.
                        // You can use a more specific color if your fog is different, e.g., `from-[#000000]`
                        // Or, if your fog has a color, use that: e.g., from-fogColor (if fogColor is a defined variable/prop)
                    }}
                />
            </div>
        </motion.div>
    );
};

export default BeatJumperPattern; 