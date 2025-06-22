// Main JavaScript for Khosraw's Portfolio
(() => {
    'use strict';

    // Constants
    const BIRTH_DATE = new Date('2005-12-05');
    
    // Journey coordinates in order
    const JOURNEY_LOCATIONS = [
        { name: 'Kabul, Afghanistan', lat: 34.5553, lng: 69.2075 },
        { name: 'New Delhi, India', lat: 28.6139, lng: 77.2090 },
        { name: 'Afghanistan', lat: 34.5553, lng: 69.2075 },
        { name: 'Kansas, USA', lat: 39.0119, lng: -98.4842 },
        { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
        { name: 'Kansas, USA', lat: 39.0119, lng: -98.4842 },
        { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
        { name: 'Kansas, USA', lat: 39.0119, lng: -98.4842 },
        { name: 'Kabul, Afghanistan', lat: 34.5553, lng: 69.2075 },
        { name: 'New Delhi, India', lat: 28.6139, lng: 77.2090 },
        { name: 'Kabul, Afghanistan', lat: 34.5553, lng: 69.2075 },
        { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Virginia, USA', lat: 37.4316, lng: -78.6569 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        // 4x Plano to Austin and back
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        // Continue journey
        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 },
        { name: 'Sacramento, CA', lat: 38.5816, lng: -121.4944 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
        { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964 },
        { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041 },
        { name: 'Brussels, Belgium', lat: 50.8503, lng: 4.3517 },
        { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
        { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
        { name: 'Plano, TX', lat: 33.0198, lng: -96.6989 },
        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 }
    ];

    const MILES_PER_DAY = 2.5; // Metaphorical miles of impact per day

    // Calculate distance between two coordinates
    function calculateDistance(coord1, coord2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
        const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Calculate total journey distance
    function calculateTotalJourneyDistance() {
        let totalDistance = 0;
        for (let i = 1; i < JOURNEY_LOCATIONS.length; i++) {
            totalDistance += calculateDistance(JOURNEY_LOCATIONS[i-1], JOURNEY_LOCATIONS[i]);
        }
        return totalDistance;
    }

    // Get unique locations
    function getUniqueLocations() {
        const unique = new Map();
        JOURNEY_LOCATIONS.forEach(loc => {
            if (!unique.has(loc.name)) {
                unique.set(loc.name, loc);
            }
        });
        return Array.from(unique.values());
    }

    // Update journey counter
    function updateJourneyCounter() {
        const now = new Date();
        const days = Math.floor((now - BIRTH_DATE) / (1000 * 60 * 60 * 24));
        const counter = document.getElementById('days-counter');
        if (counter) {
            counter.textContent = days.toLocaleString();
        }
    }

    // Update miles traveled
    function updateMilesTraveled() {
        const now = new Date();
        const days = Math.floor((now - BIRTH_DATE) / (1000 * 60 * 60 * 24));
        const baseMiles = calculateTotalJourneyDistance();
        const impactMiles = Math.floor(baseMiles + (days * MILES_PER_DAY));
        const counter = document.getElementById('miles-traveled');
        if (counter) {
            animateNumber(counter, 0, impactMiles, 2000);
        }
    }

    // Create location tooltip
    function createLocationTooltip() {
        const distanceSection = document.querySelector('.distance-traveled');
        if (!distanceSection) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'location-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            padding: var(--spacing-sm);
            border-radius: 8px;
            font-size: 0.75rem;
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, -100%);
            margin-top: -10px;
            box-shadow: 0 4px 12px var(--shadow);
            z-index: 1000;
            max-width: 300px;
            transition: opacity 0.3s ease;
        `;
        
        const uniqueLocations = getUniqueLocations();
        const locationList = uniqueLocations.map(loc => loc.name).join(' → ');
        tooltip.innerHTML = `
            <strong>Journey through:</strong><br>
            ${locationList}<br>
            <em style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
                ${uniqueLocations.length} unique locations visited
            </em>
        `;
        
        document.body.appendChild(tooltip);

        distanceSection.addEventListener('mouseenter', (e) => {
            const rect = distanceSection.getBoundingClientRect();
            tooltip.style.left = rect.left + rect.width / 2 + 'px';
            tooltip.style.top = rect.top + 'px';
            tooltip.style.opacity = '1';
        });

        distanceSection.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
    }

    // Animate number counting
    function animateNumber(element, start, end, duration) {
        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (end - start) * easeOutQuart(progress));
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        requestAnimationFrame(update);
    }

    // Easing function
    function easeOutQuart(x) {
        return 1 - Math.pow(1 - x, 4);
    }

    // Terminal effect for problem solver
    function initTerminalEffect() {
        const problemSolver = document.getElementById('problem-solver');
        const terminal = problemSolver?.querySelector('.terminal-output');
        if (!problemSolver || !terminal) return;

        const problems = [
            'Analyzing: Global productivity gaps... Solution: Pointer.so ✓',
            'Processing: Knowledge accessibility... Status: Ongoing',
            'Evaluating: Cross-cultural barriers... Approach: Bridging',
            'Solving: Information overload... Method: Elegant simplicity'
        ];

        let currentProblem = 0;
        let typing = false;

        problemSolver.addEventListener('mouseenter', () => {
            if (typing) return;
            typing = true;
            typeWriter(terminal, problems[currentProblem], () => {
                typing = false;
                currentProblem = (currentProblem + 1) % problems.length;
            });
        });
    }

    // Typewriter effect
    function typeWriter(element, text, callback) {
        element.textContent = '';
        let i = 0;
        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, 30);
            } else {
                setTimeout(() => {
                    fadeOut(element, callback);
                }, 2000);
            }
        };
        type();
    }

    // Fade out effect
    function fadeOut(element, callback) {
        let opacity = 1;
        const fade = () => {
            opacity -= 0.05;
            element.style.opacity = opacity;
            if (opacity > 0) {
                requestAnimationFrame(fade);
            } else {
                element.textContent = '';
                element.style.opacity = 1;
                callback();
            }
        };
        fade();
    }

    // Update time zones
    function updateTimeZones() {
        const update = () => {
            const now = new Date();
            
            // Afghanistan time (UTC+4:30)
            const afghanistanTime = new Date(now.getTime() + (4.5 * 60 * 60 * 1000));
            const afghanistanHours = afghanistanTime.getUTCHours().toString().padStart(2, '0');
            const afghanistanMinutes = afghanistanTime.getUTCMinutes().toString().padStart(2, '0');
            
            // Local time
            const localHours = now.getHours().toString().padStart(2, '0');
            const localMinutes = now.getMinutes().toString().padStart(2, '0');
            
            const afghanistanElement = document.querySelector('#afghanistan-time .time-value');
            const localElement = document.querySelector('#local-time .time-value');
            
            if (afghanistanElement) afghanistanElement.textContent = `${afghanistanHours}:${afghanistanMinutes}`;
            if (localElement) localElement.textContent = `${localHours}:${localMinutes}`;
        };
        
        update();
        setInterval(update, 1000);
    }

    // Social link metrics
    function updateSocialMetrics() {
        // Simulated metrics - in real implementation, these could fetch from APIs
        const metrics = {
            'github-metric': '37 repos',
            'linkedin-metric': '12000+ followers',
            'twitter-metric': 'Active'
        };

        Object.entries(metrics).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    // Journey line animation
    function animateJourneyLine() {
        const path = document.querySelector('.journey-line path');
        if (!path) return;

        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;

        setTimeout(() => {
            path.style.transition = 'stroke-dashoffset 3s ease-out';
            path.style.strokeDashoffset = '0';
        }, 1000);
    }

    // Knowledge map toggle
    function initKnowledgeMapToggle() {
        const toggle = document.getElementById('knowledge-toggle');
        const map = document.getElementById('knowledge-map');
        
        if (!toggle || !map) return;

        toggle.addEventListener('click', () => {
            map.classList.add('active');
            if (window.initKnowledgeMap) {
                window.initKnowledgeMap();
            }
        });

        // Close on escape or click outside
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && map.classList.contains('active')) {
                map.classList.remove('active');
            }
        });

        map.addEventListener('click', (e) => {
            if (e.target === map) {
                map.classList.remove('active');
            }
        });
    }

    // Konami code Easter egg
    function initKonamiCode() {
        const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
                           'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 
                           'b', 'a'];
        let konamiIndex = 0;

        document.addEventListener('keydown', (e) => {
            if (e.key === konamiCode[konamiIndex]) {
                konamiIndex++;
                if (konamiIndex === konamiCode.length) {
                    activateEasterEgg();
                    konamiIndex = 0;
                }
            } else {
                konamiIndex = 0;
            }
        });
    }

    // Easter egg activation
    function activateEasterEgg() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--accent);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            font-weight: 500;
            z-index: 10000;
            animation: fadeInOut 3s ease-out;
        `;
        message.textContent = 'good boyyyy';
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    }

    // Initialize everything
    function init() {
        updateJourneyCounter();
        updateMilesTraveled();
        createLocationTooltip();
        initTerminalEffect();
        updateTimeZones();
        updateSocialMetrics();
        animateJourneyLine();
        initKnowledgeMapToggle();
        initKonamiCode();

        // Update counters periodically
        setInterval(updateJourneyCounter, 60000); // Every minute
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 