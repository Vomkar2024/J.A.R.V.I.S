import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * SHADERS
 * Shaders are like "mini-programs" that run directly on your computer's graphics card.
 * They are responsible for drawing the AI blob's unique look.
 */
const SHADERS = {
  // Vertex Shader: This calculates the "shape" and "movement" of every single dot in the blob.
  vertex: `
    varying vec3 vUv;
    varying float vTime;
    varying float vZ;
    uniform float time;
    uniform float mouse;
    uniform float intensity;

    // These are complex math functions to create "organic" looking noise/movement
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    // Perlin Noise: A common way in computer graphics to make things look natural (like clouds or fire)
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

    // Helper to change a value from one range to another
    float map(float value, float oldMin, float oldMax, float newMin, float newMax) {
        return newMin + (newMax - newMin) * (value - oldMin) / (oldMax - oldMin);
    }

    // This is the main instruction for the shape
    void main() {
        vUv = position;
        vTime = time;
        vec3 newPos = position;
        
        // Logic to make the center parts react differently than the edges
        vec2 peak = vec2(1.0 - abs(.5 - uv.x), 1.0 - abs(.5 - uv.y));
        
        // Calculate the "fire-like" noise movement
        vec2 noise = vec2(
            map(cnoise(vec2(0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., (peak.x * peak.y * 30.)),
            map(cnoise(vec2(-0.3 * time + uv.x * 5., uv.y * 5.)), 0., 1., -2., 25.)
        );

        // Displace the position of the dots based on noise and voice volume (intensity)
        newPos.z += noise.x * .06 * noise.y * (1.0 + intensity);
        vZ = newPos.z;
        vec4 mvPosition = modelViewMatrix * vec4( newPos, 1.0 );

        gl_PointSize = 10.0; // Size of each dot in the blob
        gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader: This calculates the "color" and "brightness" of every single dot.
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
        // Calculate how bright or transparent each dot should be based on its position
        float alpha = map(vZ / 2., -1. / 2., 30. / 2., 0.17, 1.); 
        gl_FragColor = vec4(uColor, alpha) * texture2D(uTexture, gl_PointCoord);
    }
  `
};

/**
 * FireAIBlob Component
 * This is the visual representation of the AI. It uses 3D graphics (Three.js)
 * to create a glowing, pulsing sphere of particles.
 */
const FireAIBlob = ({ color, sensitivity, volume }) => {
  const containerRef = useRef(null); // Reference to the HTML element where the 3D scene lives
  const requestRef = useRef();      // Reference to the animation loop
  const materialRef = useRef();     // Reference to the blob's visual "material"
  
  // Use references to track values without re-triggering the whole 3D setup
  const sensitivityRef = useRef(sensitivity);
  const colorRef = useRef(color);
  const volumeRef = useRef(volume || 0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // 1. Setup the Scene (The virtual "world" where the AI lives)
    const width = 800;
    const height = 800;
    const scene = new THREE.Scene();
    
    // 2. Setup the Camera (How we look into the virtual world)
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000);
    camera.position.set(0, 0, 220);
    camera.lookAt(0, 0, 0);

    // 3. Setup the Renderer (The engine that draws the 3D world onto your screen)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    node.appendChild(renderer.domElement);

    // 4. Setup the Geometry (The basic shape - a sphere)
    const geometry = new THREE.SphereGeometry(22, 102, 52);
    
    // 5. Setup the Texture (The look of each dot - a little glowy spark)
    const textureLoader = new THREE.TextureLoader();
    const sparkTexture = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/1081752/spark1.png");

    // 6. Setup the Material (Combining the shaders, color, and texture)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 1.0 },
        mouse: { value: 0.0 },
        intensity: { value: 0.0 },
        uTexture: { value: sparkTexture },
        uColor: { value: new THREE.Color(colorRef.current) },
        resolution: { value: new THREE.Vector2(width, height) }
      },
      vertexShader: SHADERS.vertex,
      fragmentShader: SHADERS.fragment,
      blending: THREE.AdditiveBlending, // Makes the colors glow brighter when they overlap
      transparent: true,
      depthWrite: false,
    });
    materialRef.current = material;

    // 7. Create the Particle System (The actual AI blob)
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Track mouse movement for slight visual reactions
    let mouseX = 0;
    let mouseY = 0;
    let mouseIntensity = 0;
    let currentIntensity = 0;
    const targetColorObj = new THREE.Color(colorRef.current);

    const onMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      mouseIntensity = 0.5; // React slightly to mouse movement
    };

    window.addEventListener('mousemove', onMouseMove);

    /**
     * animate
     * This function runs at 60 frames per second to update the visual.
     */
    let time = 0;
    const animate = () => {
      time += 0.02; // Keeps the "fire" moving

      // Calculate how much the blob should pulse based on voice volume (increased multiplier for better sensitivity)
      const audioIntensity = volumeRef.current * 10.0 * (sensitivityRef.current || 1.0); 
      const targetIntensity = Math.max(audioIntensity, mouseIntensity);

      // Smoothly transition between intensity levels (increased smoothing for better responsiveness)
      currentIntensity += (targetIntensity - currentIntensity) * (0.12 * (sensitivityRef.current || 1.0)); 
      mouseIntensity *= 0.95; // Gradually forget mouse movement


      // Update the 3D material with new information (time, color, volume)
      if (materialRef.current) {
        materialRef.current.uniforms.time.value = time;
        materialRef.current.uniforms.mouse.value = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
        materialRef.current.uniforms.intensity.value = currentIntensity;
        
        targetColorObj.set(colorRef.current);
        // Smoothly transition the color if the user changes it in settings
        materialRef.current.uniforms.uColor.value.lerp(targetColorObj, 0.05);
      }

      // Draw the updated frame
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    // Cleanup: Remove everything when the component is destroyed
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(requestRef.current);
      if (node && renderer.domElement) {
        node.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Sync external props to the internal references
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  return (
    <div
      ref={containerRef}
      className="blob-container-inner"
      style={{
        width: '800px',
        height: '800px',
        margin: '0 auto',
        overflow: 'hidden',
        background: 'transparent'
      }}
    />
  );
};


export default FireAIBlob;