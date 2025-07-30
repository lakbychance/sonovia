import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import clsx from 'clsx';

interface BlackholePatternProps {
    audioData: AudioAnalysisData;
    dimensions: { width: number; height: number };
    config: VisualizationConfig;
    showControls?: boolean;
}

// Utility
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

const BLACK_HOLE_RADIUS = 1;
const DISK_INNER_RADIUS = BLACK_HOLE_RADIUS + 0.2;
const DISK_OUTER_RADIUS = 10.0;
const DISK_TILT_ANGLE = Math.PI / 3.0;

const BlackholePattern: React.FC<BlackholePatternProps> = ({ audioData, dimensions, config, showControls }) => {
    const mountRef = useRef<HTMLDivElement>(null);

    // Three.js refs
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const sceneRef = useRef<THREE.Scene>();
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const composerRef = useRef<EffectComposer>();
    const controlsRef = useRef<OrbitControls>();
    const diskMaterialRef = useRef<THREE.ShaderMaterial>();
    const eventHorizonMatRef = useRef<THREE.ShaderMaterial>();
    const lensingPassRef = useRef<ShaderPass>();
    const starMaterialRef = useRef<THREE.ShaderMaterial>();

    // Audio smoothing
    const smoothedAudio = useRef({ bass: 0, mid: 0, high: 0 });

    // Smooth factor for star streak effect (0 = none, 1 = full)
    const streakSmooth = useRef(0);

    // Smooth scaling for accretion disk radius (1 = default)
    const diskScaleSmooth = useRef(1);

    // Keep latest audio in a ref so the RAF callback always sees current values
    const latestAudio = useRef(audioData);
    useEffect(() => { latestAudio.current = audioData; }, [audioData]);

    // Build / rebuild scene when dims change
    useEffect(() => {
        if (!mountRef.current) return;

        // Dispose previous renderer if any
        if (rendererRef.current) {
            const prevDom = rendererRef.current.domElement;
            if (prevDom.parentNode === mountRef.current) {
                mountRef.current.removeChild(prevDom);
            }
            rendererRef.current.dispose();
        }

        /*************************
         * Renderer & Scene setup
         *************************/
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
        renderer.setSize(dimensions.width, dimensions.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020104, 0.025);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(80, dimensions.width / dimensions.height, 0.1, 4000);
        camera.position.set(-8.0, 6.0, 9.0);
        cameraRef.current = camera;

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composerRef.current = composer;

        // Bloom
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(dimensions.width, dimensions.height), 0.4, 0.7, 0.8);
        composer.addPass(bloomPass);
        const bloomPassRef = { current: bloomPass } as { current: UnrealBloomPass };

        /********************
         * Lensing shader
         *******************/
        const lensingShader = {
            uniforms: {
                tDiffuse: { value: null },
                blackHoleScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
                lensingStrength: { value: 0.12 },
                lensingRadius: { value: 0.3 },
                aspectRatio: { value: dimensions.width / dimensions.height },
                chromaticAberration: { value: 0.005 },
            },
            vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 blackHoleScreenPos;
        uniform float lensingStrength;
        uniform float lensingRadius;
        uniform float aspectRatio;
        uniform float chromaticAberration;
        varying vec2 vUv;
        void main(){
          vec2 screenPos = vUv;
          vec2 toCenter = screenPos - blackHoleScreenPos;
          toCenter.x *= aspectRatio;
          float dist = length(toCenter);
          float distortionAmount = lensingStrength / (dist*dist + 0.003);
          distortionAmount = clamp(distortionAmount, 0.0, 0.7);
          float falloff = smoothstep(lensingRadius, lensingRadius*0.3, dist);
          distortionAmount *= falloff;
          vec2 offset = normalize(toCenter) * distortionAmount;
          offset.x /= aspectRatio;
          vec2 distortedUvR = screenPos - offset*(1.0+chromaticAberration);
          vec2 distortedUvG = screenPos - offset;
          vec2 distortedUvB = screenPos - offset*(1.0-chromaticAberration);
          float r = texture2D(tDiffuse, distortedUvR).r;
          float g = texture2D(tDiffuse, distortedUvG).g;
          float b = texture2D(tDiffuse, distortedUvB).b;
          gl_FragColor = vec4(r,g,b,1.0);
        }`,
        } as const;
        const lensingPass = new ShaderPass(lensingShader);
        composer.addPass(lensingPass);
        lensingPassRef.current = lensingPass;

        // Orbit controls (desktop only)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.035;
        controls.rotateSpeed = 0.4;
        controls.autoRotate = false;
        controls.enableZoom = false;
        controls.target.set(0, 0, 0);
        controls.minDistance = 2.5;
        controls.maxDistance = 100;
        controls.enablePan = false;
        // Disable any user-driven interaction – we'll drive the camera fully via code
        controls.enabled = false;
        controls.update();
        controlsRef.current = controls;

        /********************
         * Stars
         *******************/
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 40000; // fewer than original for perf
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);
        const starTwinkle = new Float32Array(starCount);
        const starFieldRadius = 2000;
        const starPalette = [
            0x88aaff, 0xffaaff, 0xaaffff, 0xffddaa, 0xffeecc,
            0xffffff, 0xff8888, 0x88ff88, 0xffff88, 0x88ffff,
        ].map((c) => new THREE.Color(c));
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const phi = Math.acos(-1 + (2 * i) / starCount);
            const theta = Math.sqrt(starCount * Math.PI) * phi;
            const radius = Math.cbrt(Math.random()) * starFieldRadius + 100;
            starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPositions[i3 + 2] = radius * Math.cos(phi);
            const color = starPalette[Math.floor(Math.random() * starPalette.length)].clone();
            color.multiplyScalar(Math.random() * 0.7 + 0.3);
            starColors[i3] = color.r;
            starColors[i3 + 1] = color.g;
            starColors[i3 + 2] = color.b;
            starSizes[i] = THREE.MathUtils.randFloat(0.6, 3.0);
            starTwinkle[i] = Math.random() * Math.PI * 2;
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        starGeometry.setAttribute('twinkle', new THREE.BufferAttribute(starTwinkle, 1));

        const starMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: renderer.getPixelRatio() },
                // Factor 0-1: 0 = regular points, 1 = full streaks towards black hole
                uStreakFactor: { value: 0 },
                // World-space position of the black hole centre (origin)
                uBlackHolePos: { value: new THREE.Vector3(0, 0, 0) },
            },
            vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uStreakFactor;
        uniform vec3 uBlackHolePos;
        attribute float size;
        attribute float twinkle;
        varying vec3 vColor;
        varying float vTwinkle;
        void main(){
          vColor = color;
          vTwinkle = sin(uTime*2.5 + twinkle) * 0.5 + 0.5;
          // Compute direction from star to black hole (origin assumed)
          vec3 toBH = normalize(uBlackHolePos - position);
          // Pull stars toward the hole based on streak factor (up to 300 units)
          vec3 displacedPos = position + toBH * uStreakFactor * 300.0;

          vec4 mvPosition = modelViewMatrix * vec4(displacedPos,1.0);

          float sizeFactor = mix(1.0, 4.0, uStreakFactor);
          gl_PointSize = size * sizeFactor * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }`,
            fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main(){
          float dist = distance(gl_PointCoord, vec2(0.5));
          if(dist>0.5) discard;
          float alpha = 1.0 - smoothstep(0.0,0.5,dist);
          alpha *= (0.2 + vTwinkle*0.8);
          gl_FragColor = vec4(vColor, alpha);
        }`,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        starMaterialRef.current = starMaterial;

        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        /********************
         * Black hole meshes
         *******************/
        // Event horizon glow
        const eventHorizonGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS * 1.05, 64, 32);
        const eventHorizonMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uCameraPosition: { value: camera.position },
            },
            vertexShader: `
        varying vec3 vNormal; varying vec3 vPosition; void main(){ vNormal = normalize(normalMatrix * normal); vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: `
        uniform float uTime; uniform vec3 uCameraPosition; varying vec3 vNormal; varying vec3 vPosition;
        void main(){
          vec3 viewDir = normalize(uCameraPosition - vPosition);
          float fresnel = 1.0 - abs(dot(vNormal,viewDir));
          fresnel = pow(fresnel, 2.5);
          vec3 glowColor = vec3(1.0,0.4,0.1);
          float pulse = sin(uTime*2.5)*0.15 + 0.85;
          gl_FragColor = vec4(glowColor * fresnel * pulse, fresnel*0.4);
        }`,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
        });
        eventHorizonMatRef.current = eventHorizonMat;
        const eventHorizon = new THREE.Mesh(eventHorizonGeom, eventHorizonMat);
        scene.add(eventHorizon);

        // Black hole body (just black sphere)
        const blackHoleGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS, 64, 32);
        const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
        scene.add(blackHoleMesh);

        // Accretion disk
        const diskGeometry = new THREE.RingGeometry(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, 256, 128);
        const diskMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColorHot: { value: new THREE.Color(0xffffff) },
                uColorMid1: { value: new THREE.Color(0xff7733) },
                uColorMid2: { value: new THREE.Color(0xff4477) },
                uColorMid3: { value: new THREE.Color(0x7744ff) },
                uColorOuter: { value: new THREE.Color(0x4477ff) },
                uNoiseScale: { value: 2.5 },
                uFlowSpeed: { value: 0.22 },
                uDensity: { value: 1.3 },
            },
            vertexShader: `
        varying vec2 vUv; varying float vRadius; varying float vAngle;
        void main(){ vUv = uv; vRadius = length(position.xy); vAngle = atan(position.y, position.x); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `
        uniform float uTime; uniform vec3 uColorHot; uniform vec3 uColorMid1; uniform vec3 uColorMid2; uniform vec3 uColorMid3; uniform vec3 uColorOuter; uniform float uNoiseScale; uniform float uFlowSpeed; uniform float uDensity; varying vec2 vUv; varying float vRadius; varying float vAngle;
        // Simplex noise functions (abridged) -- credit: Ashima Arts
        vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
        vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
        vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0);
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute( permute( permute(
                      i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
          float n_ = 0.142857142857; // 1/7
          vec3  ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }
        void main(){
          float normalizedRadius = smoothstep(${DISK_INNER_RADIUS.toFixed(2)}, ${DISK_OUTER_RADIUS.toFixed(2)}, vRadius);
          float spiral = vAngle * 3.0 - (1.0 / (normalizedRadius + 0.1)) * 2.0;
          vec2 noiseUv = vec2(vUv.x + uTime*uFlowSpeed*(2.0/(vRadius*0.3+1.0)) + sin(spiral)*0.1, vUv.y*0.8 + cos(spiral)*0.1);
          float n1 = snoise(vec3(noiseUv*uNoiseScale, uTime*0.15));
          float n2 = snoise(vec3(noiseUv*uNoiseScale*3.0+0.8, uTime*0.22));
          float n3 = snoise(vec3(noiseUv*uNoiseScale*6.0+1.5, uTime*0.3));
          float noiseVal = (n1*0.45 + n2*0.35 + n3*0.2);
          noiseVal = (noiseVal + 1.0)*0.5;
          vec3 color = uColorOuter;
          color = mix(color,uColorMid3,smoothstep(0.0,0.25,normalizedRadius));
          color = mix(color,uColorMid2,smoothstep(0.2,0.55,normalizedRadius));
          color = mix(color,uColorMid1,smoothstep(0.5,0.75,normalizedRadius));
          color = mix(color,uColorHot,smoothstep(0.7,0.95,normalizedRadius));
          color *= (0.5 + noiseVal*1.0);
          float brightness = pow(1.0-normalizedRadius,1.0)*3.5 + 0.5;
          brightness *= (0.3 + noiseVal*2.2);
          float pulse = sin(uTime*1.8 + normalizedRadius*12.0 + vAngle*2.0)*0.15 + 0.85;
          brightness *= pulse;
          float alpha = uDensity * (0.2 + noiseVal*0.9);
          alpha *= smoothstep(0.0,0.15,normalizedRadius);
          alpha *= (1.0 - smoothstep(0.85,1.0,normalizedRadius));
          alpha = clamp(alpha,0.0,1.0);
          gl_FragColor = vec4(color*brightness, alpha);
        }`,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        diskMaterialRef.current = diskMaterial;

        const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
        accretionDisk.rotation.x = DISK_TILT_ANGLE;
        accretionDisk.renderOrder = 1;
        scene.add(accretionDisk);

        /********************
         * Animation loop
         *******************/
        const clock = new THREE.Clock();
        const blackHoleScreenPosVec3 = new THREE.Vector3();
        let frameId: number;

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            const deltaTime = clock.getDelta();

            /********************
             * Cinematic camera autorotation
             * -----------------------------
             * The camera follows a looping path that starts far from the black hole,
             * dives toward the inner accretion disk and then swings back out the
             * opposite side. This creates the sensation of falling into – and
             * emerging from – the black hole. The path continuously loops to keep
             * the motion flowing.
             *******************/
            const LOOP_DURATION = 20; // seconds for a full cycle
            const loopT = (elapsedTime % LOOP_DURATION) / LOOP_DURATION; // 0 → 1
            const orbitAngle = loopT * Math.PI * 2; // full 360° around BH

            // Radius smoothly oscillates between a distant view and a close pass
            const MIN_RADIUS = DISK_INNER_RADIUS + 0.6; // just above inner disk
            const MAX_RADIUS = 15.0; // fully zoomed-out view
            const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * (1 + Math.cos(orbitAngle)) / 2;

            // Add some vertical motion so the path feels like a helix / loop
            const yOscillation = Math.sin(orbitAngle * 3.0) * 2.0; // small vertical waves

            camera.position.set(Math.cos(orbitAngle) * radius, yOscillation, Math.sin(orbitAngle) * radius);
            camera.lookAt(0, 0, 0);
            // Update shader times
            diskMaterial.uniforms.uTime.value = elapsedTime;
            starMaterial.uniforms.uTime.value = elapsedTime;
            eventHorizonMat.uniforms.uTime.value = elapsedTime;
            eventHorizonMat.uniforms.uCameraPosition.value.copy(camera.position);

            // Smooth audio values
            const targetBass = Math.min(1, latestAudio.current.bassEnergy * config.sensitivity);
            const targetMid = Math.min(1, latestAudio.current.midEnergy * config.sensitivity);
            const targetHigh = Math.min(1, latestAudio.current.highEnergy * config.sensitivity);
            smoothedAudio.current.bass = lerp(smoothedAudio.current.bass, targetBass, targetBass > smoothedAudio.current.bass ? 0.08 : 0.04);
            smoothedAudio.current.mid = lerp(smoothedAudio.current.mid, targetMid, 0.04);
            smoothedAudio.current.high = lerp(smoothedAudio.current.high, targetHigh, 0.04);

            // Map audio to uniforms
            diskMaterial.uniforms.uFlowSpeed.value = 0.15 + smoothedAudio.current.high * 0.4 * config.motionIntensity;
            diskMaterial.uniforms.uDensity.value = 1.0 + smoothedAudio.current.mid * 2.0 * config.motionIntensity;
            lensingPass.uniforms.lensingStrength.value = 0.12 + smoothedAudio.current.bass * 0.5 * config.motionIntensity;
            // Chromatic aberration (hi-hat / treble spikes)
            const caBase = 0.005;
            lensingPass.uniforms.chromaticAberration.value = caBase + smoothedAudio.current.high * 0.02 * config.motionIntensity; // up to ~0.025

            // Lensing radius pulsing with bass
            const radiusBase = 0.3;
            lensingPass.uniforms.lensingRadius.value = THREE.MathUtils.clamp(
                radiusBase + smoothedAudio.current.bass * 0.2 * config.motionIntensity,
                0.1,
                0.4,
            );

            /********************
             * Star streak factor (breakdown detection)
             * We treat "breakdown" as a period of high overall energy.
             *******************/
            const overallEnergy = (smoothedAudio.current.bass + smoothedAudio.current.mid + smoothedAudio.current.high) / 3;
            const targetStreak = Math.min(1, overallEnergy * 1.5); // high energy -> high streak
            streakSmooth.current = lerp(streakSmooth.current, targetStreak, 0.05);
            starMaterial.uniforms.uStreakFactor.value = streakSmooth.current;

            // Starfield rotation (slow)
            stars.rotation.y += deltaTime * 0.003;
            stars.rotation.x += deltaTime * 0.001;

            // Accretion disk rotation – keep direction, modulate speed with energy
            const baseRotSpeed = 0.004; // base rad/sec
            const energyFactor = (smoothedAudio.current.bass * 0.6 + smoothedAudio.current.mid * 0.3 + smoothedAudio.current.high * 0.1) * config.motionIntensity;
            const rotSpeed = baseRotSpeed * (1 + energyFactor);
            accretionDisk.rotation.z += deltaTime * rotSpeed;

            // Smoothly scale accretion disk radius with energy
            const targetDiskScale = 0.5 + energyFactor * 0.5; // adjust multiplier for effect strength
            diskScaleSmooth.current = lerp(diskScaleSmooth.current, targetDiskScale, 0.5);
            accretionDisk.scale.setScalar(diskScaleSmooth.current);

            // Moderate bloom intensity to avoid over-glow at high energy
            if (bloomPassRef.current) {
                const targetBloom = 0.4 + energyFactor * 0.1; // stays in same direction, stronger with energy but capped
                bloomPassRef.current.strength = Math.min(targetBloom, 0.75);
            }

            // Update lensing pass black hole screen pos
            blackHoleScreenPosVec3.copy(blackHoleMesh.position).project(camera);
            lensingPass.uniforms.blackHoleScreenPos.value.set((blackHoleScreenPosVec3.x + 1) / 2, (blackHoleScreenPosVec3.y + 1) / 2);

            // Controls update not needed – camera is driven manually
            // controls.update();

            composer.render(deltaTime);
        };

        animate();

        /********************
         * Cleanup
         *******************/
        return () => {
            cancelAnimationFrame(frameId);
            starGeometry.dispose();
            starMaterial.dispose();
            diskGeometry.dispose();
            diskMaterial.dispose();
            eventHorizonGeom.dispose();
            eventHorizonMat.dispose();
            blackHoleGeom.dispose();

            if (renderer && mountRef.current) {
                const dom = renderer.domElement;
                if (dom.parentNode === mountRef.current) {
                    mountRef.current.removeChild(dom);
                }
            }
            renderer.dispose();
        };
    }, [dimensions.width, dimensions.height, config.motionIntensity, config.sensitivity]);

    // Handle container resize (update renderer/composer sizes without full rebuild)
    useEffect(() => {
        if (!rendererRef.current || !composerRef.current || !cameraRef.current || !lensingPassRef.current) return;
        rendererRef.current.setSize(dimensions.width, dimensions.height);
        composerRef.current.setSize(dimensions.width, dimensions.height);
        cameraRef.current.aspect = dimensions.width / dimensions.height;
        cameraRef.current.updateProjectionMatrix();
        lensingPassRef.current.uniforms.aspectRatio.value = dimensions.width / dimensions.height;
    }, [dimensions.width, dimensions.height]);

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
            <a
                href="https://x.com/techartist_/status/1943193486842323301"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={clsx("absolute top-2 right-2 lg:left-2 lg:right-auto text-xs text-white/90 p-2 rounded-xl z-10 bg-gradient-to-r from-black/10 via-zinc-900 to-white/10 border border-zinc-700/80 backdrop-blur-sm transition-all duration-400 hover:text-orange-500 hover:bg-gradient-to-r hover:from-orange-500/10 hover:via-orange-400/10 hover:to-orange-300/10 hover:border-orange-500/50",
                    showControls ? "opacity-100" : "opacity-0"
                )}
            >
                Adapted from @techartist_
            </a>
        </motion.div>
    );
};

export default BlackholePattern; 