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
});

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