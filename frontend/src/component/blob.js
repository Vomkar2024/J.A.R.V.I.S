import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const FireAIBlob = () => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // --- Shader Definitions ---
        const vertexShader = `
            vec4 mod289(vec4 x) {
                return x - floor(x * (1.0 / 289.0)) * 289.0;
            }

            vec4 permute(vec4 x) {
                return mod289(((x*34.0)+1.0)*x);
            }

            vec4 taylorInvSqrt(vec4 r) {
                return 1.79284291400159 - 0.85373472095314 * r;
            }

            vec2 fade(vec2 t) {
                return t*t*t*(t*(t*6.0-15.0)+10.0);
            }

            // Classic Perlin noise
            float cnoise(vec2 P) {
                vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
                vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
                Pi = mod289(Pi);
                vec4 ix = Pi.xzxz;
                vec4 iy = Pi.yyww;
                vec4 fx = Pf.xzxz;
                vec4 fy = Pf.yyww;

                vec4 i = permute(permute(ix) + iy);

                vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
                vec4 gy = abs(gx) - 0.5 ;
                vec4 tx = floor(gx + 0.5);
                gx = gx - tx;

                vec2 g00 = vec2(gx.x,gy.x);
                vec2 g10 = vec2(gx.y,gy.y);
                vec2 g01 = vec2(gx.z,gy.z);
                vec2 g11 = vec2(gx.w,gy.w);

                vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
                g00 *= norm.x;
                g01 *= norm.y;
                g10 *= norm.z;
                g11 *= norm.w;

                float n00 = dot(g00, vec2(fx.x, fy.x));
                float n10 = dot(g10, vec2(fx.y, fy.y));
                float n01 = dot(g01, vec2(fx.z, fy.z));
                float n11 = dot(g11, vec2(fx.w, fy.w));

                vec2 fade_xy = fade(Pf.xy);
                vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
                float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
                return 2.3 * n_xy;
            }

            float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
                return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
            }

            varying vec3 vUv;
            varying float vTime;
            varying float vZ;
            uniform float time;

            void main() {
                vUv = position;
                vTime = time;
                vec3 newPos = position;
                vec2 peak = vec2(1.0 - abs(.5 - uv.x), 1.0 - abs(.5 - uv.y));
                vec2 noise = vec2(
                    map(cnoise(vec2(0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., (peak.x * peak.y * 30.)),
                    map(cnoise(vec2(-0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., 25.)
                );

                // Slightly intensified the z-displacement for a more volatile fire look
                newPos.z += noise.x * 0.1 * noise.y;
                vZ = newPos.z;

                vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );
                gl_PointSize = 10.0;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            varying vec3 vUv;
            varying float vTime;
            varying float vZ;
            uniform sampler2D uTexture;

            float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
                return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
            }

            void main() {
                // Updated to fiery colors
                vec3 colorHot = vec3(1.0, 0.7, 0.1);  // Bright yellow-orange for the peaks
                vec3 colorCool = vec3(0.8, 0.1, 0.0); // Deep red for the troughs

                // Map the Z displacement to mix the hot and cool colors
                float mixValue = map(vZ, -5.0, 5.0, 0.0, 1.0);
                vec3 color = mix(colorCool, colorHot, clamp(mixValue, 0.0, 1.0));

                float alpha = map(vZ / 2., -1. / 2., 30. / 2., 0.3, 1.0);

                gl_FragColor = vec4( color, alpha);
                gl_FragColor = gl_FragColor * texture2D( uTexture, gl_PointCoord );
            }
        `;

        // --- Three.js Setup ---
        let time = 0;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 300; // Moved back from 180 to 300
        camera.position.y = 0;
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        
        const updateSize = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        const container = containerRef.current;
        container.appendChild(renderer.domElement);
        updateSize();

        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = '';
        const sparkTexture = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/1081752/spark1.png");

        const geometry = new THREE.SphereGeometry(65, 102, 52); // Increased radius from 40 to 65
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 1.0 },
                uTexture: { value: sparkTexture },
                resolution: { value: new THREE.Vector2() }
            },
            vertexShader,
            fragmentShader,
            blending: THREE.AdditiveBlending,
            transparent: true,
            side: THREE.DoubleSide, // Ensure both sides of the points/faces are visible
            depthWrite: false
        });

        const particles = new THREE.Points(geometry, material);
        particles.position.y = 10; // Moved higher from -15 to 10
        scene.add(particles);

        window.addEventListener('resize', updateSize);

        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            time += 0.04;
            material.uniforms.time.value = time;
            
            // Add dynamic motion: gentle rotation and floating oscillation
            particles.rotation.y += 0.005;
            particles.rotation.x += 0.002;
            particles.position.y = 10 + Math.sin(time * 0.5) * 5; 

            renderer.render(scene, camera);
        };

        animate();

        // --- Cleanup ---
        return () => {
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameId);
            if (container && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            position: 'relative'
        }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default FireAIBlob;