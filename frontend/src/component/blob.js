import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SHADERS = {
    vertex: `
    varying vec3 vUv;
    varying float vTime;
    varying float vZ;
    uniform float time;
    uniform float mouse;
    uniform float intensity;

    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float cnoise(vec2 P) {
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod289(Pi);
      vec4 ix = Pi.xzxz; vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz; vec4 fy = Pf.yyww;
      vec4 i = permute(permute(ix) + iy);
      vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
      vec4 gy = abs(gx) - 0.5;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;
      vec2 g00 = vec2(gx.x,gy.x); vec2 g10 = vec2(gx.y,gy.y);
      vec2 g01 = vec2(gx.z,gy.z); vec2 g11 = vec2(gx.w,gy.w);
      vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
      g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));
      vec2 fade_xy = fade(Pf.xy);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
    }

    float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
        return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
    }

    void main() {
        vUv = position;
        vTime = time;
        vec3 newPos = position;
        vec2 peak = vec2(1.0 - abs(.5 - uv.x), 1.0 - abs(.5 - uv.y));
        float dynamicNoise = map(cnoise(vec2(0.3 * time + uv.x * (5.0 + mouse * 2.0), uv.y * 5.0)), 0., 1., -2., (peak.x * peak.y * (30.0 + intensity * 20.0)));
        newPos.z += dynamicNoise * .06 * (1.0 + intensity);
        vZ = newPos.z;
        vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );
        gl_PointSize = 10.0;
        gl_Position = projectionMatrix * mvPosition;
    }
  `,
    fragment: `
    varying vec3 vUv;
    varying float vTime;
    varying float vZ;
    uniform sampler2D uTexture;

    float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
        return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
    }

    void main() {
        float alpha = map(vZ / 2., -0.5, 15.0, 0.17, 1.); 
        vec3 color = vec3(.5, .5, .6);
        gl_FragColor = vec4(color, alpha) * texture2D(uTexture, gl_PointCoord);
    }
  `
};

const ParticleScene = () => {
    const containerRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        const node = containerRef.current;
        // Scene Setup
        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000);
        camera.position.set(0, 0, 200);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        if (node) {
            node.appendChild(renderer.domElement);
        }

        // Particles
        const geometry = new THREE.SphereGeometry(30, 102, 52);
        const textureLoader = new THREE.TextureLoader();
        const sparkTexture = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/1081752/spark1.png");

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 1.0 },
                mouse: { value: 0.0 },
                intensity: { value: 0.0 },
                uTexture: { value: sparkTexture },
                resolution: { value: new THREE.Vector2(width, height) }
            },
            vertexShader: SHADERS.vertex,
            fragmentShader: SHADERS.fragment,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false, // Prevents square artifacts in additive blending
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Resize Handler
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };

        window.addEventListener('resize', handleResize);

        // Mouse Tracking
        let mouseX = 0;
        let mouseY = 0;
        let targetIntensity = 0;
        let currentIntensity = 0;

        const onMouseMove = (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
            targetIntensity = 1.0;
        };

        window.addEventListener('mousemove', onMouseMove);

        // Animation Loop
        let time = 0;
        const animate = () => {
            time += 0.03;
            
            // Smoothly interpolate intensity
            currentIntensity += (targetIntensity - currentIntensity) * 0.05;
            targetIntensity *= 0.98; // Decay back to idle

            material.uniforms.time.value = time;
            material.uniforms.mouse.value = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
            material.uniforms.intensity.value = currentIntensity;

            renderer.render(scene, camera);
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(requestRef.current);
            if (node) {
                node.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                background: 'transparent'
            }}
        />
    );
};

export default ParticleScene;