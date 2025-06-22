// Learning Particles Background
(() => {
    'use strict';

    class ParticleSystem {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.particles = [];
            this.knowledgeDomains = [
                'Philosophy', 'Technology', 'History', 'Politics', 
                'Science', 'Business', 'Art', 'Mathematics',
                'Psychology', 'Economics', 'Literature', 'Physics'
            ];
            this.resize();
            this.init();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }

        init() {
            // Spawn initial particles
            for (let i = 0; i < 20; i++) {
                this.spawnParticle();
            }
            
            // Spawn new particles periodically (learning velocity)
            setInterval(() => {
                if (this.particles.length < 50) {
                    this.spawnParticle();
                }
            }, 3000);

            window.addEventListener('resize', () => this.resize());
        }

        spawnParticle() {
            const particle = {
                x: Math.random() * this.canvas.width,
                y: this.canvas.height + 20,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 0.5 - 0.2,
                size: Math.random() * 3 + 1,
                opacity: 0,
                targetOpacity: Math.random() * 0.5 + 0.1,
                domain: this.knowledgeDomains[Math.floor(Math.random() * this.knowledgeDomains.length)],
                connections: []
            };
            this.particles.push(particle);
        }

        update() {
            // Update particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                
                // Movement
                p.x += p.vx;
                p.y += p.vy;
                
                // Fade in/out
                if (p.opacity < p.targetOpacity) {
                    p.opacity += 0.01;
                }
                
                // Remove if off screen
                if (p.y < -20 || p.x < -20 || p.x > this.canvas.width + 20) {
                    this.particles.splice(i, 1);
                    continue;
                }
                
                // Add slight randomness to movement
                p.vx += (Math.random() - 0.5) * 0.01;
                p.vy += (Math.random() - 0.5) * 0.01;
            }

            // Form connections between nearby particles
            this.updateConnections();
        }

        updateConnections() {
            const maxDistance = 150;
            
            for (let i = 0; i < this.particles.length; i++) {
                this.particles[i].connections = [];
                
                for (let j = i + 1; j < this.particles.length; j++) {
                    const p1 = this.particles[i];
                    const p2 = this.particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < maxDistance) {
                        p1.connections.push({
                            particle: p2,
                            distance: distance,
                            opacity: (1 - distance / maxDistance) * 0.2
                        });
                    }
                }
            }
        }

        draw() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw connections
            this.ctx.strokeStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--accent');
            
            for (const p of this.particles) {
                for (const connection of p.connections) {
                    this.ctx.globalAlpha = connection.opacity * p.opacity;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(connection.particle.x, connection.particle.y);
                    this.ctx.stroke();
                }
            }
            
            // Draw particles
            this.ctx.fillStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--accent');
            
            for (const p of this.particles) {
                this.ctx.globalAlpha = p.opacity;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw domain text occasionally
                if (Math.random() < 0.001 && p.opacity > 0.3) {
                    this.ctx.font = '10px Inter, sans-serif';
                    this.ctx.fillText(p.domain, p.x + 10, p.y);
                }
            }
            
            this.ctx.globalAlpha = 1;
        }

        animate() {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.animate());
        }
    }

    // Initialize particle system
    function initParticles() {
        const canvas = document.getElementById('particles-canvas');
        if (!canvas) return;
        
        const system = new ParticleSystem(canvas);
        system.animate();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initParticles);
    } else {
        initParticles();
    }
})(); 