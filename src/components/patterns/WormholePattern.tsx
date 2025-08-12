import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import CreditsComponent from '../CreditsComponent';

interface WormholePatternProps {
    audioData: AudioAnalysisData;
    dimensions: { width: number; height: number };
    config: VisualizationConfig;
}

// Linear interpolation helper
const lerp = (start: number, end: number, factor: number) => start * (1 - factor) + end * factor;

const WormholePattern: React.FC<WormholePatternProps> = ({ audioData, dimensions, config }) => {
    const mountRef = useRef<HTMLDivElement>(null);

    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const materialRef = useRef<THREE.PointsMaterial | null>(null);
    const tubeARef = useRef<THREE.Points | null>(null);
    const tubeBRef = useRef<THREE.Points | null>(null);
    const frameIdRef = useRef<number>(0);

    const baseGeometryRef = useRef<THREE.CylinderGeometry | null>(null);
    const colorAttributeRef = useRef<THREE.BufferAttribute | null>(null);

    // Smoothed dynamics
    const smoothedEnergyRef = useRef(0);
    const speedBurstRef = useRef(0);

    // Build or rebuild scene when size or color settings change
    useEffect(() => {
        if (!mountRef.current) return;

        // Cleanup any previous scene
        if (rendererRef.current) {
            const dom = rendererRef.current.domElement;
            if (dom.parentNode === mountRef.current) {
                mountRef.current.removeChild(dom);
            }
            rendererRef.current.dispose();
            rendererRef.current = null;
        }

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.025);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 2000);
        camera.position.set(0.5, 0.5, 15);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
        renderer.setSize(dimensions.width, dimensions.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Geometry construction (noise-deformed cylinder rendered as points)
        const radius = 5;
        const tubeLength = 200;
        const radialSegments = 250;
        const heightSegments = 1000;//
        const tubeGeo = new THREE.CylinderGeometry(radius, radius, tubeLength, radialSegments, heightSegments, true);

        // Distort vertices and generate colors
        const positionAttr = tubeGeo.attributes.position as THREE.BufferAttribute;
        const vertexCount = positionAttr.count;
        const colors = new Float32Array(vertexCount * 3);
        const noise = new ImprovedNoise();
        const tempVec = new THREE.Vector3();
        const working = new THREE.Vector3();
        const noisefreq = 0.1;
        const noiseAmp = 0.5;
        const hueNoiseFreq = 0.005;

        for (let i = 0; i < vertexCount; i++) {
            tempVec.fromBufferAttribute(positionAttr, i);
            working.copy(tempVec);
            const vertexNoise = noise.noise(working.x * noisefreq, working.y * noisefreq, working.z);
            working.addScaledVector(tempVec, vertexNoise * noiseAmp);
            // Keep y as original to preserve cylinder stacking, perturb x only for subtle swirl
            positionAttr.setXYZ(i, working.x, tempVec.y, working.z);

            // Force dynamic color mode for wormhole: compute hue via noise
            const colorNoise = noise.noise(working.x * hueNoiseFreq, working.y * hueNoiseFreq, i * 0.001 * hueNoiseFreq);
            const color = new THREE.Color();
            color.setHSL(0.55 - colorNoise * 0.4, 1.0, 0.5);
            const r = color.r; const g = color.g; const b = color.b;
            const j = i * 3;
            colors[j] = r; colors[j + 1] = g; colors[j + 2] = b;
        }

        positionAttr.needsUpdate = true;

        const colorAttr = new THREE.BufferAttribute(colors, 3);
        colorAttributeRef.current = colorAttr;
        baseGeometryRef.current = tubeGeo;

        const pointsMat = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            sizeAttenuation: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        materialRef.current = pointsMat;

        const createTube = (index: number) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', positionAttr);
            geo.setAttribute('color', colorAttr);
            const points = new THREE.Points(geo, pointsMat);
            points.rotation.x = Math.PI * 0.5;
            points.position.z = -tubeLength * index;
            return points;
        };

        const tubeA = createTube(0);
        const tubeB = createTube(1);
        tubeARef.current = tubeA;
        tubeBRef.current = tubeB;
        scene.add(tubeA, tubeB);

        const localMount = mountRef.current;
        return () => {
            cancelAnimationFrame(frameIdRef.current);
            if (tubeA) tubeA.geometry.dispose();
            if (tubeB) tubeB.geometry.dispose();
            if (pointsMat) pointsMat.dispose();
            if (tubeGeo) tubeGeo.dispose();
            if (renderer && localMount) {
                const dom = renderer.domElement;
                if (dom.parentNode === localMount) {
                    localMount.removeChild(dom);
                }
                renderer.dispose();
            }
            scene.clear();
        };
    }, [dimensions.width, dimensions.height, config.colorMode, config.baseColor]);

    // Handle resize when only dimensions change (without rebuilding colors)
    useEffect(() => {
        if (!rendererRef.current || !cameraRef.current) return;
        rendererRef.current.setSize(dimensions.width, dimensions.height);
        cameraRef.current.aspect = dimensions.width / dimensions.height;
        cameraRef.current.updateProjectionMatrix();
    }, [dimensions.width, dimensions.height]);

    // Animation loop: travel through the wormhole with audio-driven speed
    useEffect(() => {
        const animate = (t: number) => {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !tubeARef.current || !tubeBRef.current || !materialRef.current) {
                frameIdRef.current = requestAnimationFrame(animate);
                return;
            }

            // Map audio energy to speed
            const bass = Math.min(1, audioData.bassEnergy * 0.4 * config.sensitivity);
            const mid = Math.min(1, audioData.midEnergy * 0.2 * config.sensitivity);
            const high = Math.min(1, audioData.highEnergy * 0.3 * config.sensitivity);
            const overall = (bass * 0.6 + mid * 0.3 + high * 0.1);
            const rise = overall > smoothedEnergyRef.current ? 0.08 : 0.04;
            smoothedEnergyRef.current = lerp(smoothedEnergyRef.current, overall, rise);

            // Beat burst
            if (audioData.beat) {
                speedBurstRef.current = Math.min(0.6, speedBurstRef.current + 0.25);
            }
            speedBurstRef.current = lerp(speedBurstRef.current, 0, 0.05);

            const baseSpeed = 0.22;
            const speed = (baseSpeed + smoothedEnergyRef.current * 1.6 * config.motionIntensity + speedBurstRef.current);

            const tubeLength = 200;
            const endPosZ = tubeLength;
            const resetPosZ = -tubeLength;

            // Spin increases slightly with energy
            const spin = 0.003 + smoothedEnergyRef.current * 0.005 * config.motionIntensity;

            const tubeA = tubeARef.current;
            const tubeB = tubeBRef.current;
            tubeA.rotation.y += spin;
            tubeB.rotation.y += spin;
            tubeA.position.z += speed;
            tubeB.position.z += speed;
            if (tubeA.position.z > endPosZ) tubeA.position.z = resetPosZ;
            if (tubeB.position.z > endPosZ) tubeB.position.z = resetPosZ;

            // Subtle camera orbit and FOV pulse to enhance travel sensation
            const cam = cameraRef.current;
            cam.position.x = Math.cos(t * 0.0012) * (1.3 + smoothedEnergyRef.current * 0.8);
            cam.position.y = Math.sin(t * 0.0011) * (1.3 + smoothedEnergyRef.current * 0.8);
            const targetFov = (120) * Math.pow(1 - smoothedEnergyRef.current, 2) - smoothedEnergyRef.current * 10 - speedBurstRef.current * 6; // wider on bursts (feels faster)
            cam.fov = lerp(cam.fov, targetFov, 0.05);
            cam.updateProjectionMatrix();
            cam.lookAt(0, 0, 0);

            // Point size reacts subtly to speed
            materialRef.current.size = 0.01 + Math.pow(1 - smoothedEnergyRef.current, 0.5) * 0.06;

            rendererRef.current.render(sceneRef.current, cam);
            frameIdRef.current = requestAnimationFrame(animate);
        };

        frameIdRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameIdRef.current);
    }, [audioData, config.motionIntensity, config.sensitivity]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
            style={{ background: '#000000' }}
        >
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            <CreditsComponent href="https://www.youtube.com/watch?v=Il_GKGFggWY" label="Adapted from @bobbyroe" show={true} />
        </motion.div>
    );
};

export default WormholePattern;

