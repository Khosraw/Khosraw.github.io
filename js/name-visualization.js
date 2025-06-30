// Initialize Three.js
let scene, camera, renderer, particles = [];
let mouseX = 0, mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Name particle positions (simplified for example)
const namePositions = [
    // K positions
    {x: -1.5, y: 0.5}, {x: -1.5, y: 0}, {x: -1.5, y: -0.5},
    {x: -1.2, y: 0.25}, {x: -1.0, y: 0}, {x: -0.8, y: -0.25},
    
    // H positions
    {x: -0.4, y: 0.5}, {x: -0.4, y: 0}, {x: -0.4, y: -0.5},
    {x: -0.1, y: 0}, {x: 0.2, y: 0.5}, {x: 0.2, y: 0}, {x: 0.2, y: -0.5},
    
    // O positions (circle)
    {x: 0.6, y: 0.4}, {x: 0.7, y: 0.2}, {x: 0.7, y: -0.2}, {x: 0.6, y: -0.4},
    {x: 0.4, y: -0.4}, {x: 0.3, y: -0.2}, {x: 0.3, y: 0.2}, {x: 0.4, y: 0.4},
    
    // ... (positions for S, R, A, W, A, Z, I, Z, I)
];

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('name-canvas'),
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create particles
    createParticles();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
}

function createParticles() {
    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
        transparent: true,
        opacity: 0.9
    });
    
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    
    // Create particles in random positions
    for (let i = 0; i < 500; i++) {
        positions.push(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    particles.push(particleSystem);
    
    // Animate particles to form name
    setTimeout(() => {
        animateToNamePositions(geometry);
    }, 1000);
}

function animateToNamePositions(geometry) {
    const positions = geometry.attributes.position.array;
    const originalPositions = [...positions];
    
    // Set target positions
    for (let i = 0; i < namePositions.length * 3; i += 3) {
        const idx = Math.floor(i / 3);
        if (namePositions[idx]) {
            positions[i] = namePositions[idx].x;
            positions[i + 1] = namePositions[idx].y;
            positions[i + 2] = 0;
        }
    }
    
    // Animate transition
    const startTime = Date.now();
    const duration = 2000;
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        for (let i = 0; i < positions.length; i += 3) {
            const targetX = positions[i];
            const targetY = positions[i + 1];
            const targetZ = positions[i + 2];
            
            geometry.attributes.position.array[i] = 
                originalPositions[i] + (targetX - originalPositions[i]) * ease;
                
            geometry.attributes.position.array[i + 1] = 
                originalPositions[i + 1] + (targetY - originalPositions[i + 1]) * ease;
                
            geometry.attributes.position.array[i + 2] = 
                originalPositions[i + 2] + (targetZ - originalPositions[i + 2]) * ease;
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    update();
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouseX = (event.clientX - windowHalfX) / 100;
    mouseY = (event.clientY - windowHalfY) / 100;
}

function animate() {
    requestAnimationFrame(animate);
    
    // Move camera with mouse
    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (-mouseY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);
    
    // Rotate particles
    particles.forEach(particle => {
        particle.rotation.x += 0.001;
        particle.rotation.y += 0.002;
    });
    
    renderer.render(scene, camera);
} 