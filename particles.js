// FluencyFlow - 3D Particle Visualizer Engine (Three.js)

class ParticleEngine {
    constructor() {
        this.container = document.querySelector('.canvas-container');
        this.canvas = document.getElementById('particle-canvas');
        
        // Settings
        this.maxParticles = 60000;
        this.spinEnabled = true;
        this.spinSpeed = 0.003;
        
        // Three.js Core Components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.group = null; // Container group for parallax rotation
        this.particleSystem = null;
        
        // Disperse and Restore baseline states
        this.isDispersed = false;
        this.baselinePositions = null;
        this.baselineColors = null;
        
        // Mouse interaction state
        this.mouse = new THREE.Vector2(-999, -999);
        this.raycaster = new THREE.Raycaster();
        this.cursor3D = new THREE.Vector3(-999, -999, -999);
        this.smoothCursor3D = new THREE.Vector3(-999, -999, -999);
        this.virtualPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.interactionIntensity = 0.0;
        
        // Slider Initial Settings
        this.defaultParticleSize = 0.9;
        
        // Animation States
        this.transition = {
            progress: 0,
            duration: 2.2,
            ease: "power3.inOut"
        };
        
        // Data arrays for morphing
        this.sourcePositions = new Float32Array(this.maxParticles * 3);
        this.targetPositions = new Float32Array(this.maxParticles * 3);
        this.sourceColors = new Float32Array(this.maxParticles * 3);
        this.targetColors = new Float32Array(this.maxParticles * 3);
        this.currentPositions = new Float32Array(this.maxParticles * 3);
        this.currentColors = new Float32Array(this.maxParticles * 3);
        this.activeCount = 0;
        
        this.init();
    }

    init() {
        // 1. Scene Setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0914, 0.002);

        // 2. Camera Setup
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 80);

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. Controls Setup
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 200;

        // 5. Container Group
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // 5a. Sci-Fi Holographic Grid Floor (Cyan grid Helper)
        const gridHelper = new THREE.GridHelper(120, 24, 0x00f0ff, 0x072a3a);
        gridHelper.position.y = -35;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        // 6. Slider configurations & bindings (Only particle size needed now)
        const sizeSlider = document.getElementById('slider-particle-size');
        
        if (sizeSlider) {
            this.defaultParticleSize = parseFloat(sizeSlider.value);
            sizeSlider.addEventListener('input', (e) => {
                const size = parseFloat(e.target.value);
                this.defaultParticleSize = size;
                if (this.particleSystem && this.particleSystem.material) {
                    this.particleSystem.material.size = size;
                }
            });
        }

        // 7. Build Particle Geometry & Material
        const geometry = new THREE.BufferGeometry();
        
        // Initialize arrays with default values
        geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.currentColors, 3));
        
        // Create procedurally a clean, sharp circular particle texture
        const texture = this.createParticleTexture();

        const material = new THREE.PointsMaterial({
            size: this.defaultParticleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            map: texture,
            alphaTest: 0.05, // Discard transparent edges for correct rendering
            depthWrite: true // Depth writing enabled for natural layering
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.group.add(this.particleSystem);

        // 8. Generate default breathing 3D globe
        this.generateDefaultSphere();

        // 9. Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseleave', () => this.onMouseLeave());
        
        // 10. Start Rendering Loop
        this.animate();
        
        // Console visual notification
        console.log("Particle Engine initialized successfully. Total particles capacity:", this.maxParticles);
    }

    createParticleTexture() {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Draw a solid anti-aliased white circle with a very slight soft edge for high quality
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 1.5, 0, Math.PI*2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    generateDefaultSphere() {
        const radius = 25;
        this.activeCount = 45000;
        
        // Clear lists
        for (let i = 0; i < this.maxParticles; i++) {
            if (i < this.activeCount) {
                // Spherical coordinates
                const u = Math.random();
                const v = Math.random();
                const theta = u * 2.0 * Math.PI;
                const phi = Math.acos(2.0 * v - 1.0);
                
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.sin(phi) * Math.sin(theta);
                const z = radius * Math.cos(phi);
                
                // Base particle
                this.targetPositions[i * 3] = x;
                this.targetPositions[i * 3 + 1] = y;
                this.targetPositions[i * 3 + 2] = z;
                
                // Color mapping: Purple to Pinkish to blue
                const r = 0.5 + 0.5 * Math.sin(x * 0.05 + phi);
                const g = 0.2 + 0.3 * Math.cos(y * 0.05 + theta);
                const b = 0.8 + 0.2 * Math.sin(z * 0.05);
                
                this.targetColors[i * 3] = r;
                this.targetColors[i * 3 + 1] = g;
                this.targetColors[i * 3 + 2] = b;
            } else {
                // Unused particles cluster inside center hidden
                this.targetPositions[i * 3] = 0;
                this.targetPositions[i * 3 + 1] = 0;
                this.targetPositions[i * 3 + 2] = 0;
                this.targetColors[i * 3] = 0;
                this.targetColors[i * 3 + 1] = 0;
                this.targetColors[i * 3 + 2] = 0;
            }
        }
        
        // Copy target directly to current on start
        for (let i = 0; i < this.maxParticles * 3; i++) {
            this.currentPositions[i] = this.targetPositions[i];
            this.currentColors[i] = this.targetColors[i];
        }
        
        // Store baseline positions and colors for Restore
        this.baselinePositions = new Float32Array(this.targetPositions);
        this.baselineColors = new Float32Array(this.targetColors);
        this.isDispersed = false;

        const btnDisperse = document.getElementById('btn-disperse');
        if (btnDisperse) {
            btnDisperse.innerHTML = '<i class="fa-solid fa-wind"></i>';
            btnDisperse.title = "粒子离散测试";
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
        this.particleSystem.geometry.computeBoundingSphere();
        
        document.getElementById('particle-count').innerText = `Particles: ${this.activeCount}`;
    }

    // Convert an uploaded image into 3D particles
    loadImageAndConvert(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (imageUrl.startsWith('http')) {
                img.crossOrigin = "anonymous";
            }
            img.src = imageUrl;
            
            img.onload = () => {
                // Create temporary canvas to read pixels
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Calculate dimensions for downsampling
                // target around 40,000 - 55,000 particles for high detail
                let width = img.width;
                let height = img.height;
                const maxDimension = 240;
                
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                
                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCtx.drawImage(img, 0, 0, width, height);
                
                const imgData = tempCtx.getImageData(0, 0, width, height);
                const pixels = imgData.data;
                
                // Copy current display state to source positions
                for (let i = 0; i < this.maxParticles * 3; i++) {
                    this.sourcePositions[i] = this.currentPositions[i];
                    this.sourceColors[i] = this.currentColors[i];
                }
                
                // Map pixels to target positions/colors
                let particleIndex = 0;
                const aspect = width / height;
                const scale = 50; // Max size bounding box in 3D
                
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (particleIndex >= this.maxParticles) break;
                        
                        const pixelIdx = (y * width + x) * 4;
                        const r = pixels[pixelIdx] / 255;
                        const g = pixels[pixelIdx + 1] / 255;
                        const b = pixels[pixelIdx + 2] / 255;
                        const a = pixels[pixelIdx + 3] / 255;
                        
                        // Ignore transparent pixels for better edge definition
                        if (a < 0.1) {
                            continue;
                        }
                        
                        // Ignore pure black or very dark background pixels to prevent ugly black squares
                        const brightness = (r + g + b) / 3;
                        if (brightness < 0.05) {
                            continue;
                        }
                        
                        // Calculate normalized distance from image center (0, 0)
                        const dxCenter = (x / width) - 0.5;
                        const dyCenter = (y / height) - 0.5;
                        const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) * 2.0;
                        
                        // 1. Probabilistic Drop (particle density gradient)
                        let keepProbability = 1.0;
                        if (distFromCenter > 0.4) {
                            keepProbability = Math.max(0.0, 1.0 - Math.pow((distFromCenter - 0.4) / 0.8, 1.5));
                        }
                        if (Math.random() > keepProbability) {
                            continue;
                        }
                        
                        // 2. Progressive Scatter (break the hard boundaries)
                        let scatter = 0;
                        if (distFromCenter > 0.5) {
                            scatter = Math.pow((distFromCenter - 0.5) / 0.9, 2.5) * 12.0;
                        }
                        const randomOffsetX = (Math.random() - 0.5) * scatter;
                        const randomOffsetY = (Math.random() - 0.5) * scatter;
                        const randomOffsetZ = (Math.random() - 0.5) * scatter;
                        
                        // Normalized coordinates centered at (0, 0)
                        const pX = ((x / width) - 0.5) * scale * aspect + randomOffsetX;
                        const pY = (0.5 - (y / height)) * scale + randomOffsetY;
                        
                        // Extrude Z based on pixel brightness (Darker = push back, Brighter = pull forward) + scatter
                        const pZ = (brightness - 0.5) * 8.0 + randomOffsetZ;
                        
                        const idx = particleIndex * 3;
                        this.targetPositions[idx] = pX;
                        this.targetPositions[idx + 1] = pY;
                        this.targetPositions[idx + 2] = pZ;
                        
                        // 3. Brightness fade near edges (gradient fade into dark background)
                        let fade = 1.0;
                        if (distFromCenter > 0.4) {
                            fade = Math.max(0.05, 1.0 - Math.pow((distFromCenter - 0.4) / 0.8, 2.0));
                        }
                        
                        // Add some texture vibrancy
                        this.targetColors[idx] = Math.min(1.0, r * 1.1 * fade);
                        this.targetColors[idx + 1] = Math.min(1.0, g * 1.1 * fade);
                        this.targetColors[idx + 2] = Math.min(1.0, b * 1.1 * fade);
                        
                        particleIndex++;
                    }
                }
                
                this.activeCount = particleIndex;
                document.getElementById('particle-count').innerText = `Particles: ${this.activeCount}`;
                
                // Send remaining particles in the pool to rest far away and make them invisible
                for (let i = this.activeCount; i < this.maxParticles; i++) {
                    const idx = i * 3;
                    // Disperse them in a very wide spherical cloud far behind the far clipping plane (far = 1000)
                    const theta = Math.random() * Math.PI * 2;
                    const r = 200 + Math.random() * 200;
                    this.targetPositions[idx] = Math.cos(theta) * r;
                    this.targetPositions[idx + 1] = Math.sin(theta) * r;
                    this.targetPositions[idx + 2] = -999; // Deeply out of camera clipping range (far = 1000)
                    
                    // Make them fully black (invisible)
                    this.targetColors[idx] = 0.0;
                    this.targetColors[idx + 1] = 0.0;
                    this.targetColors[idx + 2] = 0.0;
                }
                
                // Store baseline positions and colors for Restore
                this.baselinePositions = new Float32Array(this.targetPositions);
                this.baselineColors = new Float32Array(this.targetColors);
                this.particleSystem.geometry.computeBoundingSphere();
                this.isDispersed = false;

                const btnDisperse = document.getElementById('btn-disperse');
                if (btnDisperse) {
                    btnDisperse.innerHTML = '<i class="fa-solid fa-wind"></i>';
                    btnDisperse.title = "粒子离散测试";
                }
                
                // Trigger morphing animation using GSAP
                this.triggerMorphAnimation();
                resolve(this.activeCount);
            };
            
            img.onerror = (err) => {
                reject(err);
            };
        });
    }

    triggerMorphAnimation() {
        // Reset progress
        this.transition.progress = 0;
        
        // Stop spin controls during main transition for wow factor
        const wasSpinning = this.spinEnabled;
        this.spinEnabled = false;
        
        // Animate camera rotation slightly to reveal 3D effect
        gsap.killTweensOf(this.camera.position);
        gsap.to(this.camera.position, {
            x: 10,
            y: 5,
            z: 75,
            duration: 2.2,
            ease: "power2.out"
        });

        // Compute Y and X bounds of target coordinates for staggering (sand falling with wave edges)
        let minY = Infinity, maxY = -Infinity;
        let minX = Infinity, maxX = -Infinity;
        for (let i = 0; i < this.maxParticles; i++) {
            const x = this.targetPositions[i * 3];
            const y = this.targetPositions[i * 3 + 1];
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }
        const yRange = (maxY - minY) || 1;
        const xRange = (maxX - minX) || 1;
        
        // Morph particles positions and colors with a futuristic swirling double-helix vortex and energy glow
        gsap.killTweensOf(this.transition);
        gsap.to(this.transition, {
            progress: 1.0,
            duration: 3.2, // Majestic duration to appreciate the swirls
            ease: "power2.inOut",
            onUpdate: () => {
                const p = this.transition.progress;
                
                for (let i = 0; i < this.maxParticles; i++) {
                    const idx = i * 3;
                    
                    const xSource = this.sourcePositions[idx];
                    const ySource = this.sourcePositions[idx + 1];
                    const zSource = this.sourcePositions[idx + 2];
                    
                    const xTarget = this.targetPositions[idx];
                    const yTarget = this.targetPositions[idx + 1];
                    const zTarget = this.targetPositions[idx + 2];
                    
                    // Normalize coordinates (0.0 to 1.0)
                    const yNorm = (yTarget - minY) / yRange; 
                    const xNorm = (xTarget - minX) / xRange;
                    
                    // Wave pattern for transition front (looks like wind-blown sand dunes or sea waves rolling down)
                    const waveOffset = Math.sin(xNorm * Math.PI * 3.0 + yNorm * Math.PI) * 0.08 
                                     + Math.cos(xNorm * Math.PI * 7.0) * 0.04;
                                     
                    // Base stagger delay + wavy boundaries. Clamp to [0, 0.4] of progress space
                    const delay = Math.max(0, Math.min(0.4, (1.0 - yNorm) * 0.35 + waveOffset));
                    
                    // Flight progress of this specific particle
                    const particleDuration = 0.6; // takes 60% of the total transition timeline
                    let pI = (p - delay) / particleDuration;
                    pI = Math.max(0, Math.min(1.0, pI));
                    
                    // Smoothstep easing for individual particle flight
                    const easePI = pI * pI * (3.0 - 2.0 * pI);
                    const invPI = 1.0 - easePI;
                    
                    // Polar representation around Y-axis for swirling vortex swirl
                    const rS = Math.sqrt(xSource * xSource + zSource * zSource) || 1;
                    const thetaS = Math.atan2(zSource, xSource);
                    
                    const rT = Math.sqrt(xTarget * xTarget + zTarget * zTarget) || 1;
                    const thetaT = Math.atan2(zTarget, xTarget);
                    
                    const midFactor = Math.sin(pI * Math.PI); // peak in middle of flight
                    
                    // 1. Swirl radius: explodes outwards slightly in the middle of flight for cosmic shield look
                    const currentR = rS * invPI + rT * easePI + midFactor * 16.0;
                    
                    // 2. Double-helix rotation swirl: even index rotates clockwise, odd index rotates counter-clockwise
                    const swirlRotations = 1.6 * Math.PI; // swirl angle
                    const direction = (i % 2 === 0) ? 1.0 : -1.0;
                    const currentTheta = thetaS * invPI + thetaT * easePI + midFactor * swirlRotations * direction;
                    
                    // Cartesian coordinate back-projection
                    let x = Math.cos(currentTheta) * currentR;
                    let z = Math.sin(currentTheta) * currentR;
                    let y = ySource * invPI + yTarget * easePI;
                    
                    // 3. Gravity dip: drop down in Y during middle of flight
                    y -= midFactor * 10.0;
                    
                    this.currentPositions[idx] = x;
                    this.currentPositions[idx + 1] = y;
                    this.currentPositions[idx + 2] = z;
                    
                    // Color morphing with glowing energy charging effect:
                    // Flying particles turn into neon cyan (for even) or neon pink (for odd) and fade back to pixel colors on landing!
                    const rBase = this.sourceColors[idx] * invPI + this.targetColors[idx] * easePI;
                    const gBase = this.sourceColors[idx + 1] * invPI + this.targetColors[idx + 1] * easePI;
                    const bBase = this.sourceColors[idx + 2] * invPI + this.targetColors[idx + 2] * easePI;
                    
                    if (pI > 0.0 && pI < 1.0) {
                        const isEven = i % 2 === 0;
                        // Neon Cyan (0, 1, 1) or Neon Pink (1, 0, 0.6)
                        const energyR = isEven ? 0.0 : 1.0;
                        const energyG = isEven ? 0.95 : 0.0;
                        const energyB = isEven ? 1.0 : 0.6;
                        
                        this.currentColors[idx] = rBase * (1.0 - midFactor) + energyR * midFactor;
                        this.currentColors[idx + 1] = gBase * (1.0 - midFactor) + energyG * midFactor;
                        this.currentColors[idx + 2] = bBase * (1.0 - midFactor) + energyB * midFactor;
                    } else {
                        this.currentColors[idx] = rBase;
                        this.currentColors[idx + 1] = gBase;
                        this.currentColors[idx + 2] = bBase;
                    }
                }
                
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
                this.particleSystem.geometry.attributes.color.needsUpdate = true;
            },
            onComplete: () => {
                this.spinEnabled = wasSpinning;
                console.log("Vortex double-helix morph completed.");
            }
        });
    }

    // Force disperse particles (Wind blow effect) / Restore particles toggle
    disperse() {
        const btnDisperse = document.getElementById('btn-disperse');
        
        if (this.isDispersed) {
            // RESTORE back to original image/sphere positions
            for (let i = 0; i < this.maxParticles * 3; i++) {
                this.sourcePositions[i] = this.currentPositions[i];
                this.sourceColors[i] = this.currentColors[i];
                this.targetPositions[i] = this.baselinePositions[i];
                this.targetColors[i] = this.baselineColors[i];
            }
            this.isDispersed = false;
            
            if (btnDisperse) {
                btnDisperse.innerHTML = '<i class="fa-solid fa-wind"></i>';
                btnDisperse.title = "粒子离散测试";
                btnDisperse.classList.remove('active');
            }
        } else {
            // DISPERSE (blow particles away)
            for (let i = 0; i < this.maxParticles * 3; i++) {
                this.sourcePositions[i] = this.currentPositions[i];
                this.sourceColors[i] = this.currentColors[i];
            }

            for (let i = 0; i < this.maxParticles; i++) {
                const idx = i * 3;
                // Blow away along random vectors
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const dist = 120 + Math.random() * 80;
                
                this.targetPositions[idx] = this.sourcePositions[idx] + dist * Math.sin(phi) * Math.cos(theta);
                this.targetPositions[idx+1] = this.sourcePositions[idx+1] + dist * Math.sin(phi) * Math.sin(theta);
                this.targetPositions[idx+2] = this.sourcePositions[idx+2] + dist * Math.cos(phi);
            }
            this.isDispersed = true;
            
            if (btnDisperse) {
                btnDisperse.innerHTML = '<i class="fa-solid fa-compress-arrows-alt"></i>';
                btnDisperse.title = "一键聚合恢复";
                btnDisperse.classList.add('active'); // highlight button state
            }
        }

        // Trigger animation
        this.triggerMorphAnimation();
    }

    // Reset camera position
    resetView() {
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            z: 80,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
                this.controls.update();
            }
        });
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    onMouseMove(e) {
        if (!this.renderer || !this.camera || !this.particleSystem) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // Check boundary: if outside canvas, reset cursor3D
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            this.cursor3D.set(-999, -999, -999);
            return;
        }
        
        // NDC coordinates
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.mouse.set(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Force update matrixWorld to ensure projection accuracy
        this.particleSystem.updateMatrixWorld(true);
        
        // Setup plane local to particleSystem
        const localNormal = new THREE.Vector3(0, 0, 1);
        const worldNormal = localNormal.transformDirection(this.particleSystem.matrixWorld);
        const localPosition = new THREE.Vector3(0, 0, 0);
        const worldPosition = localPosition.applyMatrix4(this.particleSystem.matrixWorld);
        
        this.virtualPlane.setFromNormalAndCoplanarPoint(worldNormal, worldPosition);
        
        const worldIntersect = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.virtualPlane, worldIntersect)) {
            this.cursor3D.copy(worldIntersect);
            this.particleSystem.worldToLocal(this.cursor3D);
        } else {
            this.cursor3D.set(-999, -999, -999);
        }
    }

    onMouseLeave() {
        this.mouse.set(-999, -999);
        this.cursor3D.set(-999, -999, -999);
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        
        // Update interactive magnification cursor smoothing and intensity
        const hasMouse = this.cursor3D.x !== -999 && this.cursor3D.y !== -999;
        if (hasMouse) {
            this.interactionIntensity += (1.0 - this.interactionIntensity) * 0.12;
            if (this.smoothCursor3D.x === -999) {
                this.smoothCursor3D.copy(this.cursor3D);
            } else {
                this.smoothCursor3D.lerp(this.cursor3D, 0.12);
            }
        } else {
            this.interactionIntensity += (0.0 - this.interactionIntensity) * 0.12;
            if (this.interactionIntensity < 0.005) {
                this.interactionIntensity = 0.0;
                this.smoothCursor3D.set(-999, -999, -999);
            }
        }
        
        // 1. Slow rotation animation (applied on group to rotate both particles and background plane)
        if (this.spinEnabled && this.group) {
            this.group.rotation.y += this.spinSpeed;
            // Minor wobbling breathing effect on rotation
            this.group.rotation.x = Math.sin(time * 0.0005) * 0.08;
        } else if (this.group) {
            // Restore rotation gently if spin disabled
            this.group.rotation.x *= 0.95;
        }

        // 2. Shimmering vortex flow in idle state (not during transition)
        if (this.transition.progress === 0 || this.transition.progress === 1.0) {
            const posAttr = this.particleSystem.geometry.attributes.position;
            const size = this.activeCount;
            
            const timeFactor = time * 0.0015;
            const interactionRadius = 8.5;
            const interactionRadiusSq = interactionRadius * interactionRadius;
            
            for (let i = 0; i < this.maxParticles; i++) {
                const idx = i * 3;
                
                // For unused particles, only apply a gentle background drifting
                if (i >= size) {
                    this.currentPositions[idx] = this.targetPositions[idx] + Math.cos(timeFactor + i) * 0.1;
                    this.currentPositions[idx+1] = this.targetPositions[idx+1] + Math.sin(timeFactor + i) * 0.1;
                    this.currentPositions[idx+2] = this.targetPositions[idx+2] + Math.sin(timeFactor * 0.5 + i * 0.05) * 0.1;
                    continue;
                }
                
                // Gentle orbital motion around baseline target coordinates (looks like shimmering sand grains)
                const angle = timeFactor + this.targetPositions[idx] * 0.05 + this.targetPositions[idx+1] * 0.05;
                
                const baseShimX = Math.cos(angle) * 0.2;
                const baseShimY = Math.sin(angle) * 0.2;
                const baseShimZ = Math.sin(timeFactor * 0.5 + i * 0.01) * 0.15;
                
                let offsetX = 0;
                let offsetY = 0;
                let offsetZ = 0;
                
                if (this.interactionIntensity > 0 && this.smoothCursor3D.x !== -999) {
                    const dx = this.targetPositions[idx] - this.smoothCursor3D.x;
                    const dy = this.targetPositions[idx+1] - this.smoothCursor3D.y;
                    const distSq = dx * dx + dy * dy;
                    
                    if (distSq < interactionRadiusSq) {
                        const dist = Math.sqrt(distSq);
                        const r = dist / interactionRadius;
                        
                        // Use smoothstep for softer edge transitions
                        const factor = 1.0 - r;
                        const smoothFactor = factor * factor * (3.0 - 2.0 * factor) * this.interactionIntensity;
                        
                        // Softer Z-lift (bulge out towards camera)
                        offsetZ = smoothFactor * 7.5;
                        
                        // Softer X/Y magnification
                        if (dist > 0.1) {
                            const pushForce = smoothFactor * 0.18;
                            offsetX = dx * pushForce;
                            offsetY = dy * pushForce;
                        }
                    }
                }
                
                this.currentPositions[idx] = this.targetPositions[idx] + baseShimX + offsetX;
                this.currentPositions[idx+1] = this.targetPositions[idx+1] + baseShimY + offsetY;
                this.currentPositions[idx+2] = this.targetPositions[idx+2] + baseShimZ + offsetZ;
            }
            posAttr.needsUpdate = true;
        }

        // 2b. Neural reconstruction digital glitch effect (during active transition)
        if (this.transition.progress > 0.05 && this.transition.progress < 0.95) {
            const posAttr = this.particleSystem.geometry.attributes.position;
            if (Math.random() < 0.06) {
                const glitchOffset = (Math.random() - 0.5) * 1.8;
                const glitchAxis = Math.random() < 0.5 ? 0 : 1; // Offset X or Y
                
                const startIdx = Math.floor(Math.random() * this.activeCount);
                const length = Math.floor(Math.random() * 150);
                for (let j = startIdx; j < Math.min(this.activeCount, startIdx + length); j++) {
                    this.currentPositions[j * 3 + glitchAxis] += glitchOffset;
                }
                posAttr.needsUpdate = true;
            }
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate visualizer when page loads
let visualizerEngine;
window.addEventListener('DOMContentLoaded', () => {
    visualizerEngine = new ParticleEngine();
    window.visualizerEngine = visualizerEngine; // Expose globally for app.js
    
    // Wire up visual controls
    const btnSpin = document.getElementById('btn-spin');
    const btnReset = document.getElementById('btn-reset-view');
    const btnDisperse = document.getElementById('btn-disperse');
    
    if (btnSpin) {
        btnSpin.classList.add('active'); // Spinning by default
        btnSpin.addEventListener('click', () => {
            visualizerEngine.spinEnabled = !visualizerEngine.spinEnabled;
            btnSpin.classList.toggle('active', visualizerEngine.spinEnabled);
        });
    }
    
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            visualizerEngine.resetView();
        });
    }
    
    if (btnDisperse) {
        btnDisperse.addEventListener('click', () => {
            visualizerEngine.disperse();
        });
    }
});
