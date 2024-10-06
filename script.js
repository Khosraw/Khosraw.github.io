document.addEventListener('DOMContentLoaded', (event) => {
    const startupAnimation = document.querySelector('.startup-animation');
    const contentWrapper = document.querySelector('.content-wrapper');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const nameElement = document.getElementById('interactive-name');

    // Create particles
    createParticles();

    // Setup startup animation
    setupStartupAnimation();

    // Setup interactive name
    setupInteractiveName();

    // Apply interactive text
    applyInteractiveText();

    // Setup event listeners
    setupEventListeners();

    // Initialize particle background
    initParticles();
});

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    let particles = [];
    let mouse = { x: null, y: null };
    const colors = ['#03dac6', '#bb86fc', '#ff0266'];
    const colorOptions = ['#03dac6', '#bb86fc', '#ff0266', '#ff8a65', '#80deea'];

    // Adjust canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Particle constructor
    function Particle(x, y, dx, dy, size, color) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.size = size;
        this.color = color;
        this.shape = Math.random() > 0.5 ? 'circle' : 'triangle';
    
        this.draw = function() {
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            if (this.shape === 'circle') {
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fill();
            } else if (this.shape === 'triangle') {
                ctx.moveTo(this.x, this.y - this.size);
                ctx.lineTo(this.x + this.size, this.y + this.size);
                ctx.lineTo(this.x - this.size, this.y + this.size);
                ctx.closePath();
                ctx.fill();
            }
        };
    
        this.update = function() {
            // Move particles
            this.x += this.dx;
            this.y += this.dy;
        
            // Bounce off edges
            if (this.x + this.size > canvas.width || this.x - this.size < 0) {
                this.dx = -this.dx;
            }
            if (this.y + this.size > canvas.height || this.y - this.size < 0) {
                this.dy = -this.dy;
            }
        
            // Interactivity
            if (mouse.x !== null && mouse.y !== null) {
                let distance = Math.hypot(mouse.x - this.x, mouse.y - this.y);
                if (distance < 150) { // Increased interaction radius
                    const forceDirectionX = this.x - mouse.x;
                    const forceDirectionY = this.y - mouse.y;
                    const maxDistance = 150;
                    const force = (maxDistance - distance) / maxDistance;
                    const directionX = forceDirectionX / distance;
                    const directionY = forceDirectionY / distance;
                    const maxForce = 2;
                    const forceX = directionX * force * maxForce;
                    const forceY = directionY * force * maxForce;
        
                    this.dx += forceX;
                    this.dy += forceY;
                }
            }
        
            // Limit speed to prevent particles from moving too fast
            const speedLimit = 2;
            const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            if (speed > speedLimit) {
                this.dx = (this.dx / speed) * speedLimit;
                this.dy = (this.dy / speed) * speedLimit;
            }
        
            // Change color based on speed
            const speedFactor = Math.min(speed / speedLimit, 1);
            this.color = interpolateColor(colorOptions[0], colorOptions[2], speedFactor);
        
            this.draw();
        };
        
        // Utility function to interpolate between two colors
        function interpolateColor(color1, color2, factor) {
            const c1 = hexToRgb(color1);
            const c2 = hexToRgb(color2);
            const r = Math.round(c1.r + (c2.r - c1.r) * factor);
            const g = Math.round(c1.g + (c2.g - c1.g) * factor);
            const b = Math.round(c1.b + (c2.b - c1.b) * factor);
            return `rgb(${r}, ${g}, ${b})`;
        }
        
        // Utility function to convert hex to RGB
        function hexToRgb(hex) {
            // Remove '#' if present
            hex = hex.replace('#', '');
            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }
            const bigint = parseInt(hex, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return { r, g, b };
        }
    }

    // Click event listener for bursts
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        createBurst(clickX, clickY);
    });

    // Function to create a burst of particles
    function createBurst(x, y) {
        const burstCount = 10;
        for (let i = 0; i < burstCount; i++) {
            let size = Math.random() * 3 + 1;
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 3 + 1;
            let dx = Math.cos(angle) * speed;
            let dy = Math.sin(angle) * speed;
            let color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
            particles.push(new Particle(x, y, dx, dy, size, color));
        }
    }

    // Initialize particles
    function init() {
        particles = [];
        let particleCount;
        if (canvas.width < 600) {
            particleCount = (canvas.width * canvas.height) / 20000;
        } else {
            particleCount = (canvas.width * canvas.height) / 10000;
        }
        for (let i = 0; i < particleCount; i++) {
            let size = Math.random() * 3 + 1;
            let x = Math.random() * (canvas.width - size * 2) + size;
            let y = Math.random() * (canvas.height - size * 2) + size;
            let dx = (Math.random() - 0.5) * 1;
            let dy = (Math.random() - 0.5) * 1;
            let color = colors[Math.floor(Math.random() * colors.length)];
            particles.push(new Particle(x, y, dx, dy, size, color));
        }
    }

    function connectParticles() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                let distance = Math.hypot(particles[a].x - particles[b].x, particles[a].y - particles[b].y);
                if (distance < 100) {
                    const opacity = 1 - distance / 100;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }
    
    function animate() {
        requestAnimationFrame(animate);
        ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        particles.forEach(particle => particle.update());
        connectParticles();
    }

    // Event listeners
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        init();
    });

    function throttle(fn, wait) {
        let time = Date.now();
        return function(...args) {
            if ((time + wait - Date.now()) < 0) {
                fn.apply(this, args);
                time = Date.now();
            }
        }
    }

    window.addEventListener('mousemove', throttle((e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    }, 50));

    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Initialize and start animation
    init();
    animate();
}

function createParticles() {
    const startupAnimation = document.querySelector('.startup-animation');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        const size = 2 + Math.random() * 3;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        startupAnimation.appendChild(particle);
    }
}

function setupStartupAnimation() {
    const startupAnimation = document.querySelector('.startup-animation');
    const contentWrapper = document.querySelector('.content-wrapper');
    setTimeout(() => {
        startupAnimation.classList.add('fade-out');
        contentWrapper.classList.remove('blurred');
        setTimeout(() => {
            startupAnimation.style.display = 'none';
        }, 500);
    }, 2500);
}

function isElementPartiallyInViewport(el) {
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);
    return (vertInView && horInView);
}

function handleScroll() {
    const sections = document.querySelectorAll('.section');
    const subsections = document.querySelectorAll('.experience-item, .education-item');
    sections.forEach(function(section) {
        if (isElementPartiallyInViewport(section)) {
            section.classList.add('visible');
        } else {
            section.classList.remove('visible');
        }
    });
    subsections.forEach(function(subsection) {
        if (isElementPartiallyInViewport(subsection)) {
            subsection.classList.add('visible');
        } else {
            subsection.classList.remove('visible');
        }
    });

    // Scroll indicator functionality
    const scrollPosition = window.scrollY;
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollPosition > 100) {
        scrollIndicator.style.opacity = '0';
    } else {
        scrollIndicator.style.opacity = '1';
    }
}

function handleMouseMove(event) {
    const item = event.currentTarget;
    const rect = item.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    item.style.setProperty('--mouse-x', `${x}px`);
    item.style.setProperty('--mouse-y', `${y}px`);
    // Calculate tilt with increased effect
    const tiltX = -(y / rect.height - 0.5) * 15; // Max 7.5 degree tilt
    const tiltY = (x / rect.width - 0.5) * 15; // Max 7.5 degree tilt
    item.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.05)`;
}

function handleMouseLeave(event) {
    const item = event.currentTarget;
    item.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
}

function setupInteractiveName() {
    const nameElement = document.getElementById('interactive-name');
    const letters = nameElement.textContent.split('');
    nameElement.textContent = '';
    letters.forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.className = 'interactive-letter';
        nameElement.appendChild(span);
    });
}

function applyInteractiveText() {
    const interactiveElements = document.querySelectorAll('[data-interactive]');
    interactiveElements.forEach(element => {
        const words = element.textContent.split(' ');
        const wrappedContent = words.map(word => 
            `<span class="interactive-text">${word}</span>`
        ).join(' ');
        element.innerHTML = wrappedContent;
    });
}

function setupEventListeners() {
    const items = document.querySelectorAll('.experience-item, .education-item');
    items.forEach(item => {
        item.addEventListener('mousemove', handleMouseMove);
        item.addEventListener('mouseleave', handleMouseLeave);
    });

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('load', handleScroll);

    // Background interactivity
    document.addEventListener('mousemove', (e) => {
        const circles = document.querySelectorAll('.blur-circle');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        circles.forEach((circle, index) => {
            const offsetX = (index === 0 ? -1 : 1) * 50 * (x - 0.5);
            const offsetY = (index === 0 ? -1 : 1) * 50 * (y - 0.5);
            circle.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        });
    });

    // Scroll indicator click functionality
    const scrollIndicator = document.querySelector('.scroll-indicator');
    scrollIndicator.addEventListener('click', () => {
        window.scrollTo({
            top: window.innerHeight,
            behavior: 'smooth'
        });
    });
}