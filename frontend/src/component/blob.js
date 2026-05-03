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

    // Classic Perlin noise
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
        vec2 noise = vec2(
            map(cnoise(vec2(0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., (peak.x * peak.y * 30.)),
            map(cnoise(vec2(-0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., 25.)
        );

        newPos.z += noise.x * .06 * noise.y * (1.0 + intensity);
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
    uniform vec3 uColor;

    float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
        return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
    }

    void main() {
        float alpha = map(vZ / 2., -1. / 2., 30. / 2., 0.17, 1.); 
        gl_FragColor = vec4(uColor, alpha) * texture2D(uTexture, gl_PointCoord);
    }
  `
};

const ParticleScene = ({ color, size, sensitivity, isDraggable, onPositionChange }) => {

  const containerRef = useRef(null);
  const requestRef = useRef();
  const materialRef = useRef();
  const particlesRef = useRef();
  const sensitivityRef = useRef(sensitivity);
  const colorRef = useRef(color);


  useEffect(() => {
    const node = containerRef.current;
    // Scene Setup - Use a fixed size for the blob container
    const width = 800;
    const height = 800;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000);
    camera.position.set(0, 0, 220); // More centered camera position
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    if (node) {
      node.appendChild(renderer.domElement);
    }

    // Particles
    const geometry = new THREE.SphereGeometry(22, 102, 52);
    const textureLoader = new THREE.TextureLoader();
    const sparkTexture = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/1081752/spark1.png");

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 1.0 },
        mouse: { value: 0.0 },
        intensity: { value: 0.0 },
        uTexture: { value: sparkTexture },
        uColor: { value: new THREE.Color(color) },
        resolution: { value: new THREE.Vector2(width, height) }
      },
      vertexShader: SHADERS.vertex,
      fragmentShader: SHADERS.fragment,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    particlesRef.current = particles;
    particles.position.y = 0;
    scene.add(particles);

    // Resize Handler - No longer needed for fixed size but kept for consistency
    const handleResize = () => {
      // renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Mouse Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetIntensity = 0;
    let currentIntensity = 0;
    const targetColorObj = new THREE.Color(colorRef.current);

    const onMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      targetIntensity = 1.0;
    };

    window.addEventListener('mousemove', onMouseMove);

    // Animation Loop
    let time = 0;
    const animate = () => {
      time += 0.02; // Slightly slower base motion

      // Smoothly interpolate intensity with sensitivity
      currentIntensity += (targetIntensity - currentIntensity) * (0.02 * (sensitivityRef.current || 1.0));
      targetIntensity *= 0.99; // Slower decay for smoother transitions


      if (materialRef.current) {
        materialRef.current.uniforms.time.value = time;
        materialRef.current.uniforms.mouse.value = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
        materialRef.current.uniforms.intensity.value = currentIntensity;
        
        // Smooth color transition
        targetColorObj.set(colorRef.current);
        materialRef.current.uniforms.uColor.value.lerp(targetColorObj, 0.05);
      }


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '800px',
        height: '800px',
        margin: '0 auto', // Center inside its wrapper
        overflow: 'hidden',
        background: 'transparent'
      }}
    />
  );
};

export default ParticleScene;