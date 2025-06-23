import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';

interface FluxPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const fluidFragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float bassEnergy;
  uniform float midEnergy;
  uniform float highEnergy;
  uniform vec3 colorA;
  uniform vec3 colorB;
  uniform vec3 colorC;
  uniform float sensitivity;
  uniform float motionIntensity;

  float concentric_ripple(vec2 p, vec2 center, float speed, float frequency, float amplitude, float time) {
    float dist = length(p - center);
    float wave = sin(dist * frequency - time * speed);
    float attenuation = 1.0 / (1.0 + dist * 1.5);
    return wave * attenuation * amplitude;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 p = (gl_FragCoord.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);
    
    float time = iTime * 0.3 * motionIntensity;
    float flowSpeed = 0.4 * motionIntensity;
    
    vec2 rippleDisplacement = vec2(0.0);
    float totalRippleEffect = 0.0;
    
    // Scale energies by sensitivity
    float scaledBassEnergy = bassEnergy * sensitivity;
    float scaledMidEnergy = midEnergy * sensitivity;
    float scaledHighEnergy = highEnergy * sensitivity;
    
    if (scaledBassEnergy > 0.15) {
      int gridSize = 2;
      for (int x = 0; x < gridSize; x++) {
        for (int y = 0; y < gridSize; y++) {
          vec2 gridPos = vec2(
            float(x) / float(gridSize-1) * 2.0 - 1.0, 
            float(y) / float(gridSize-1) * 2.0 - 1.0
          );
          
          vec2 center = gridPos + vec2(
            sin(time * 0.3 + float(x*y)) * 0.1,
            cos(time * 0.2 + float(x+y)) * 0.1
          ) * 0.5 * motionIntensity;
          
          float speed = 120.0 + scaledBassEnergy * 1.5;
          float frequency = 50.0 - scaledBassEnergy * 13.5;
          float amplitude = 0.1 + scaledBassEnergy * 0.12;
          
          float ripple = concentric_ripple(p, center, speed, frequency, amplitude, time);
          rippleDisplacement += vec2(ripple * 0.03 * motionIntensity);
          
          totalRippleEffect += abs(ripple) * scaledBassEnergy * 0.25;
        }
      }
    }
    
    if (scaledMidEnergy > 0.15) {
      int gridSize = 3;
      for (int x = 0; x < gridSize; x++) {
        for (int y = 0; y < gridSize; y++) {
          vec2 gridPos = vec2(
            float(x) / float(gridSize-1) * 2.0 - 1.0, 
            float(y) / float(gridSize-1) * 2.0 - 1.0
          );
          
          vec2 center = gridPos + vec2(
            sin(time * 0.4 + float(x+y*2)) * 0.08,
            cos(time * 0.5 + float(x*2+y)) * 0.08
          ) * 0.5 * motionIntensity;
          
          float speed = 4.5 + scaledMidEnergy * 2.0;
          float frequency = 10.0 - scaledMidEnergy * 1.2;
          float amplitude = 0.3 + scaledMidEnergy * 0.1;
          
          float ripple = concentric_ripple(p, center, speed, frequency, amplitude, time);
          rippleDisplacement += vec2(ripple * 0.025 * motionIntensity);
          
          totalRippleEffect += abs(ripple) * scaledMidEnergy * 0.2;
        }
      }
    }
    
    if (scaledHighEnergy > 0.15) {
      int gridSize = 4;
      for (int x = 0; x < gridSize; x++) {
        for (int y = 0; y < gridSize; y++) {
          vec2 gridPos = vec2(
            float(x) / float(gridSize-1) * 2.0 - 1.0, 
            float(y) / float(gridSize-1) * 2.0 - 1.0
          );
          
          vec2 center = gridPos + vec2(
            sin(time * 0.6 + float(x*y+3)) * 0.06,
            cos(time * 0.7 + float(x+y*3)) * 0.06
          ) * 0.5 * motionIntensity;
          
          float speed = 13.0 + scaledHighEnergy * 2.5;
          float frequency = 20.0 - scaledHighEnergy * 1.0;
          float amplitude = 0.2 + scaledHighEnergy * 0.08;
          
          float ripple = concentric_ripple(p, center, speed, frequency, amplitude, time);
          rippleDisplacement += vec2(ripple * 0.02 * motionIntensity);
          
          totalRippleEffect += abs(ripple) * scaledHighEnergy * 0.15;
        }
      }
    }
    
    vec2 fluidP = p + rippleDisplacement * 0.8;
    
    for(float i = 1.0; i < 6.0; i++) {
      float amp = 0.6 / i;
      float xFreq = 2.5;
      float yFreq = 2.0;
      
      float phase = time * flowSpeed;
      
      fluidP.x += amp * sin(i * xFreq * fluidP.y + phase) * motionIntensity;
      fluidP.y += amp * cos(i * yFreq * fluidP.x + phase * 0.8) * motionIntensity;
    }
    
    vec3 col = vec3(0);
    col += colorA * (0.5 + 0.4 * sin(fluidP.x + time));
    col += colorB * (0.5 + 0.4 * cos(fluidP.y + time * 0.9));
    col += colorC * (0.5 + 0.4 * sin(length(fluidP) * 1.5 + time * 0.7));
    
    float swirlIntensity = 3.0 * motionIntensity;
    float swirl = sin(atan(fluidP.y, fluidP.x) * swirlIntensity + time);
    col *= 0.85 + 0.15 * swirl;
    
    col += mix(colorA, colorB, sin(time) * 0.5 + 0.5) * totalRippleEffect * 0.25;
    
    float energySum = scaledBassEnergy * 0.3 + scaledMidEnergy * 0.2 + scaledHighEnergy * 0.1;
    col *= 1.0 + energySum * 0.15;
    
    float vignette = 1.0 - length(uv - 0.5) * 0.7;
    col *= vignette;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lerp = (start: number, end: number, factor: number) => {
  return start * (1 - factor) + end * factor;
};

const FluxPattern: React.FC<FluxPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const timeRef = useRef(0);
  const frameIdRef = useRef<number>(0);
  const [_, setFps] = useState(0);

  const smoothedAudioRef = useRef({
    bass: 0,
    mid: 0,
    high: 0
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    cameraRef.current = camera;

    const getColor = (index: number) => {
      if (config.colorMode === 'monochrome') {
        const color = new THREE.Color(config.baseColor);
        return color.offsetHSL(index * 0.1, 0, 0);
      }
      return new THREE.Color(
        index === 0 ? 0xff3b30 :
          index === 1 ? 0x5856d6 :
            0xff9500
      );
    };

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(dimensions.width, dimensions.height) },
        bassEnergy: { value: 0.1 },
        midEnergy: { value: 0.1 },
        highEnergy: { value: 0.1 },
        colorA: { value: getColor(0) },
        colorB: { value: getColor(1) },
        colorC: { value: getColor(2) },
        sensitivity: { value: config.sensitivity },
        motionIntensity: { value: config.motionIntensity }
      },
      vertexShader: vertexShader,
      fragmentShader: fluidFragmentShader
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(dimensions.width / 2, dimensions.height / 2),
      1.2,
      0.4,
      0.85
    );

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      geometry.dispose();
      material.dispose();
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const animate = (timestamp: number) => {
      if (!composerRef.current || !materialRef.current) {
        frameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      lastTime = timestamp;

      timeRef.current += 0.01;

      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      const targetBass = Math.min(1.0, (audioData.bassEnergy || 0) * 1.2);
      const targetMid = Math.min(1.0, (audioData.midEnergy || 0) * 1.2);
      const targetHigh = Math.min(1.0, (audioData.highEnergy || 0) * 1.2);

      const smoothingFactor = 0.04;
      const bassRiseFactor = 0.08;
      const bassFallFactor = 0.03;

      smoothedAudioRef.current.bass = targetBass > smoothedAudioRef.current.bass
        ? lerp(smoothedAudioRef.current.bass, targetBass, bassRiseFactor)
        : lerp(smoothedAudioRef.current.bass, targetBass, bassFallFactor);

      smoothedAudioRef.current.mid = lerp(smoothedAudioRef.current.mid, targetMid, smoothingFactor);
      smoothedAudioRef.current.high = lerp(smoothedAudioRef.current.high, targetHigh, smoothingFactor);

      if (materialRef.current) {
        materialRef.current.uniforms.iTime.value = timeRef.current;
        materialRef.current.uniforms.bassEnergy.value = smoothedAudioRef.current.bass;
        materialRef.current.uniforms.midEnergy.value = smoothedAudioRef.current.mid;
        materialRef.current.uniforms.highEnergy.value = smoothedAudioRef.current.high;
        materialRef.current.uniforms.sensitivity.value = config.sensitivity;
        materialRef.current.uniforms.motionIntensity.value = config.motionIntensity;
      }

      composerRef.current.render();

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
    };
  }, [audioData, config.sensitivity, config.motionIntensity]);

  useEffect(() => {
    if (!materialRef.current) return;

    const getColor = (index: number) => {
      if (config.colorMode === 'monochrome') {
        const color = new THREE.Color(config.baseColor);
        return color.offsetHSL(index * 0.1, 0, 0);
      }
      return new THREE.Color(
        index === 0 ? 0xff3b30 :
          index === 1 ? 0x5856d6 :
            0xff9500
      );
    };

    materialRef.current.uniforms.colorA.value = getColor(0);
    materialRef.current.uniforms.colorB.value = getColor(1);
    materialRef.current.uniforms.colorC.value = getColor(2);
  }, [config.colorMode, config.baseColor]);

  useEffect(() => {
    const handleResize = () => {
      if (!rendererRef.current || !composerRef.current || !materialRef.current) return;

      rendererRef.current.setSize(dimensions.width, dimensions.height);
      composerRef.current.setSize(dimensions.width, dimensions.height);
      materialRef.current.uniforms.iResolution.value = new THREE.Vector2(
        dimensions.width, dimensions.height
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dimensions]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
      style={{ background: '#121212' }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>
    </motion.div>
  );
};

export default FluxPattern;