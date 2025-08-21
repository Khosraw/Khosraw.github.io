// Particle System for Khosraw Azizi
// Using birthdate (Dec 5, 2005) as seed for generative elements

class ParticleSystem {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        
        this.particles = [];
        this.particleGeometry = null;
        this.particleMaterial = null;
        this.particleSystem = null;
        
        this.starData = [];
        this.starField = null;
        
        this.mouse = new THREE.Vector2(0, 0);
        this.targetMouse = new THREE.Vector2(0, 0);
        this.isMouseDown = false;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Configuration based on birthdate
        const isSmallMobile = window.innerWidth < 480 || window.innerHeight < 600;
        this.config = {
            particlesPerLetter: isSmallMobile ? 50 : (this.isMobile ? 80 : 120),
            explosionForce: 5,
            attractionForce: 0.05,
            damping: 0.95,
            mouseRadius: this.isMobile ? 150 : 100,
            cycleTime: 19000, // 19 seconds
            birthSeed: 1205 // Dec 5
        };
        
        this.text = "KHOSRAW AZIZI";
        this.farsiText = "خسرو عزیزی";
        this.isEnglish = true;
        this.textPositions = [];
        this.isFormed = true;
        this.lastExplosion = 0;
        
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('particle-canvas').appendChild(this.renderer.domElement);
        
        // Setup camera
        this.camera.position.z = this.isMobile ? 70 : 50;
        this.camera.position.y = this.isMobile ? 0 : 5; // Lower position on mobile to center name
        
        // Create particles
        this.createTextParticles();
        
        // Setup lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Add star field background
        this.createStarField();
        
        // Event listeners
        this.setupEventListeners();

        // Add right-click listener for language switching
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.switchLanguage();
        });
        
        // Start animation
        this.animate();
        
        // Particles are ready - no HTML name to show
    }
    
    createTextParticles() {
        // Create canvas for text rendering
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = this.isMobile ? 50 : 100;
        
        canvas.width = 1024;
        canvas.height = 256;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = `${fontSize}px Inter`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);
        
        // Get text data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Extract text positions
        for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
                const index = (y * canvas.width + x) * 4;
                if (data[index] > 128) {
                    this.textPositions.push({
                        x: (x - canvas.width / 2) * 0.1,
                        y: -(y - canvas.height / 2) * 0.1,
                        z: 0
                    });
                }
            }
        }
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particlesPerLetter * this.text.length * 3);
        const colors = new Float32Array(this.config.particlesPerLetter * this.text.length * 3);
        const sizes = new Float32Array(this.config.particlesPerLetter * this.text.length);
        
        // Initialize particles
        for (let i = 0; i < this.config.particlesPerLetter * this.text.length; i++) {
            const i3 = i * 3;
            const targetIndex = i % this.textPositions.length;
            const target = this.textPositions[targetIndex];
            
            // Start particles exactly at their target positions
            positions[i3] = target.x;
            positions[i3 + 1] = target.y;
            positions[i3 + 2] = target.z;
            
            // Color gradient (white to amber)
            const t = i / (this.config.particlesPerLetter * this.text.length);
            colors[i3] = 1;
            colors[i3 + 1] = 1 - t * 0.3;
            colors[i3 + 2] = 1 - t * 0.5;
            
            sizes[i] = Math.random() * 2 + 1;
            
            // Store particle data - starting at target position
            this.particles.push({
                x: target.x,
                y: target.y,
                z: target.z,
                targetX: target.x,
                targetY: target.y,
                targetZ: target.z,
                vx: 0,
                vy: 0,
                vz: 0,
                originalSize: sizes[i]
            });
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create material with custom shader
        this.particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 20 } // Start at 20 to skip initial wave animation
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vSize;
                
                void main() {
                    vColor = color;
                    vSize = size;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vSize;
                
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                    if (r > 0.5) discard;
                    
                    float opacity = 1.0 - smoothstep(0.0, 0.5, r);
                    gl_FragColor = vec4(vColor, opacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.particleSystem = new THREE.Points(geometry, this.particleMaterial);
        this.scene.add(this.particleSystem);
        
        this.particleGeometry = geometry;
    }
    
    createStarField() {
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const radius = 100 + Math.random() * 400;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            positions[i3]     = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            const brightness = 0.3 + Math.random() * 0.4;
            const size = 0.4 + Math.random() * 0.4;

            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;
            sizes[i] = size;

            this.starData.push({
                originalBrightness: brightness,
                originalSize: size,
                twinkleSpeed: Math.random() * 0.01 + 0.005,
                twinklePhase: Math.random() * Math.PI * 2
            });
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starsMaterial = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.starField = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.starField);
    }
    
    setupEventListeners() {
        // Mouse/Touch events
        if (this.isMobile) {
            window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            window.addEventListener('touchend', () => this.onTouchEnd(), { passive: false });
            
            // Device orientation for mobile
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', (e) => this.onDeviceOrientation(e));
            }
        } else {
            window.addEventListener('mousemove', (e) => this.onMouseMove(e));
            window.addEventListener('mousedown', () => this.onMouseDown());
            window.addEventListener('mouseup', () => this.onMouseUp());
            window.addEventListener('dblclick', () => this.explode());
        }
        
        window.addEventListener('resize', () => this.onResize());
    }
    
    onMouseMove(event) {
        this.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    onTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        this.targetMouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.targetMouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        this.isMouseDown = true;
        
        // Double tap detection
        const now = Date.now();
        if (now - this.lastExplosion < 300) {
            this.explode();
        }
        this.lastExplosion = now;
    }
    
    onTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        this.targetMouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.targetMouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
    
    onTouchEnd() {
        this.isMouseDown = false;
    }
    
    onDeviceOrientation(event) {
        if (event.beta && event.gamma) {
            const x = event.gamma / 90;
            const y = event.beta / 180;
            this.targetMouse.x = x * 0.5;
            this.targetMouse.y = y * 0.5;
        }
    }
    
    onMouseDown() {
        this.isMouseDown = true;
    }
    
    onMouseUp() {
        this.isMouseDown = false;
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    explode() {
        this.isFormed = false;
        this.particles.forEach(particle => {
            const force = this.config.explosionForce;
            particle.vx = (Math.random() - 0.5) * force;
            particle.vy = (Math.random() - 0.5) * force;
            particle.vz = (Math.random() - 0.5) * force;
        });

        setTimeout(() => {
            this.isFormed = true;
        }, 1000);
    }

    switchLanguage() {
        // Switch text
        this.isEnglish = !this.isEnglish;
        this.text = this.isEnglish ? "KHOSRAW AZIZI" : this.farsiText;

        // Remove current particle system
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
        }

        // Clear current data
        this.particles = [];
        this.textPositions = [];

        // Recreate with new text
        this.createTextParticles();
    }
    
    updateStarField() {
        // Trigger new supernovas
        if (Math.random() < 0.0005) { // Small chance each frame
            const starIndex = Math.floor(Math.random() * this.starData.length);
            if (!this.starData[starIndex].supernova) {
                this.starData[starIndex].supernova = { progress: 0, duration: 120 }; // 2 seconds
            }
        }

        const colors = this.starField.geometry.attributes.color.array;
        const sizes = this.starField.geometry.attributes.size.array;

        for (let i = 0; i < this.starData.length; i++) {
            const star = this.starData[i];
            let brightness = star.originalBrightness;
            let size = star.originalSize;

            // Twinkling
            star.twinklePhase += star.twinkleSpeed;
            const twinkleValue = (Math.sin(star.twinklePhase) + 1) / 2 * 0.5;
            brightness += twinkleValue;

            // Supernova
            if (star.supernova) {
                star.supernova.progress++;
                const progress = star.supernova.progress / star.supernova.duration;
                const peak = Math.sin(progress * Math.PI); // 0 -> 1 -> 0 curve
                brightness += peak * 50; // Flare up
                size += peak * 15.0;

                if (star.supernova.progress >= star.supernova.duration) {
                    star.supernova = null; // End of supernova
                }
            }
            
            const i3 = i * 3;
            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;
            sizes[i] = size;
        }
        this.starField.geometry.attributes.color.needsUpdate = true;
        this.starField.geometry.attributes.size.needsUpdate = true;
    }
    
    updateParticles() {
        const positions = this.particleGeometry.attributes.position.array;
        const sizes = this.particleGeometry.attributes.size.array;
        
        // Smooth mouse movement
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;
        
        // Convert mouse to world coordinates
        const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
        vector.unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const mousePos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const i3 = i * 3;
            
            // Calculate forces
            let fx = 0, fy = 0, fz = 0;
            
            // Attraction to target position
            if (this.isFormed) {
                fx += (particle.targetX - particle.x) * this.config.attractionForce;
                fy += (particle.targetY - particle.y) * this.config.attractionForce;
                fz += (particle.targetZ - particle.z) * this.config.attractionForce;
            }
            
            // Mouse interaction
            const dx = mousePos.x - particle.x;
            const dy = mousePos.y - particle.y;
            const dz = -particle.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance < this.config.mouseRadius) {
                const force = (1 - distance / this.config.mouseRadius) * 0.5;
                if (this.isMouseDown) {
                    // Attract
                    fx += dx * force * 0.1;
                    fy += dy * force * 0.1;
                    fz += dz * force * 0.1;
                } else {
                    // Repel
                    fx -= dx * force * 0.05;
                    fy -= dy * force * 0.05;
                    fz -= dz * force * 0.05;
                }
                
                // Size effect
                sizes[i] = particle.originalSize * (1 + force * 0.5);
            } else {
                sizes[i] = particle.originalSize;
            }
            
            // Update velocity
            particle.vx += fx;
            particle.vy += fy;
            particle.vz += fz;
            
            // Apply damping
            particle.vx *= this.config.damping;
            particle.vy *= this.config.damping;
            particle.vz *= this.config.damping;
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.z += particle.vz;
            
            // Update geometry
            positions[i3] = particle.x;
            positions[i3 + 1] = particle.y;
            positions[i3 + 2] = particle.z;
        }
        
        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.size.needsUpdate = true;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateParticles();
        this.updateStarField();
        
        // Update time uniform
        const time = this.particleMaterial.uniforms.time.value;
        this.particleMaterial.uniforms.time.value += 0.01;
        
        // Slowly rotate starfield
        if (this.starField) {
            this.starField.rotation.y += 0.0001;
            this.starField.rotation.x += 0.00005;
        }
        
        // Automatic subtle wave animation every 19 seconds (age reference)
        const cycleProgress = (time * 10) % this.config.cycleTime;
        if (cycleProgress < 100) {
            const waveProgress = cycleProgress / 100;
            this.particles.forEach((particle, i) => {
                const delay = i / this.particles.length;
                const waveForce = Math.sin((waveProgress + delay) * Math.PI) * 0.5;
                particle.vx += Math.sin(i * 0.1) * waveForce * 0.05;
                particle.vy += Math.cos(i * 0.1) * waveForce * 0.05;
            });
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ParticleSystem();
}); 