// Knowledge Map Visualization
(() => {
    'use strict';

    class KnowledgeMap {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.nodes = [];
            this.connections = [];
            this.mouse = { x: 0, y: 0 };
            this.hoveredNode = null;
            this.isDragging = false;
            this.draggedNode = null;
            this.camera = { x: 0, y: 0, zoom: 1 };
            this.tooltip = document.querySelector('.knowledge-tooltip');
            
            this.initializeNodes();
            this.resize();
            this.bindEvents();
        }

        initializeNodes() {
            // Size reduction per level
            const SIZE_REDUCTION = 0.7;
            const BASE_SIZE = 45;
            
            // Core knowledge domains with nested children
            const domains = [
                {
                    id: 'philosophy',
                    label: 'Philosophy',
                    x: 0,
                    y: 0,
                    color: '#3B82F6',
                    size: BASE_SIZE,
                    children: [
                        { 
                            label: 'Ethics', 
                            x: -80, 
                            y: -60,
                            children: [
                                { label: 'Virtue Ethics', x: -120, y: -100 },
                                { label: 'Consequentialism', x: -140, y: -60 },
                                { label: 'Deontology', x: -100, y: -40 }
                            ]
                        },
                        { 
                            label: 'Metaphysics', 
                            x: -100, 
                            y: 20,
                            children: [
                                { label: 'Ontology', x: -150, y: 10 },
                                { label: 'Cosmology', x: -140, y: 40 }
                            ]
                        },
                        { 
                            label: 'Epistemology', 
                            x: -60, 
                            y: 80,
                            children: [
                                { label: 'Empiricism', x: -100, y: 100 },
                                { label: 'Rationalism', x: -80, y: 120 }
                            ]
                        },
                        { label: 'Logic', x: 20, y: -80 }
                    ]
                },
                {
                    id: 'technology',
                    label: 'Technology',
                    x: 200,
                    y: -100,
                    color: '#10B981',
                    size: BASE_SIZE + 5,
                    children: [
                        { 
                            label: 'AI/ML', 
                            x: 150, 
                            y: -150,
                            children: [
                                { label: 'Neural Networks', x: 120, y: -180 },
                                { label: 'NLP', x: 160, y: -190 },
                                { label: 'Computer Vision', x: 180, y: -160 },
                                { 
                                    label: 'Reinforcement Learning', 
                                    x: 140, 
                                    y: -220,
                                    children: [
                                        { label: 'Q-Learning', x: 100, y: -250 },
                                        { label: 'Policy Gradient', x: 150, y: -260 }
                                    ]
                                }
                            ]
                        },
                        { 
                            label: 'Web Dev', 
                            x: 250, 
                            y: -120,
                            children: [
                                { label: 'Frontend', x: 280, y: -150 },
                                { label: 'Backend', x: 300, y: -110 },
                                { label: 'DevOps', x: 270, y: -90 }
                            ]
                        },
                        { 
                            label: 'Systems', 
                            x: 220, 
                            y: -40,
                            children: [
                                { label: 'Distributed Systems', x: 260, y: -20 },
                                { label: 'Operating Systems', x: 240, y: 0 }
                            ]
                        },
                        { label: 'Security', x: 280, y: -80 }
                    ]
                },
                {
                    id: 'history',
                    label: 'History',
                    x: -200,
                    y: 100,
                    color: '#F59E0B',
                    size: BASE_SIZE - 5,
                    children: [
                        { 
                            label: 'Ancient', 
                            x: -280, 
                            y: 60,
                            children: [
                                { label: 'Greece', x: -320, y: 40 },
                                { label: 'Rome', x: -310, y: 70 },
                                { label: 'Egypt', x: -330, y: 90 }
                            ]
                        },
                        { label: 'Modern', x: -250, y: 140 },
                        { 
                            label: 'Afghanistan', 
                            x: -180, 
                            y: 180,
                            children: [
                                { label: 'Ancient Bactria', x: -220, y: 200 },
                                { label: 'Islamic Period', x: -180, y: 220 },
                                { label: 'Modern Era', x: -160, y: 200 }
                            ]
                        }
                    ]
                },
                {
                    id: 'politics',
                    label: 'Politics',
                    x: -150,
                    y: -150,
                    color: '#EF4444',
                    size: BASE_SIZE - 2,
                    children: [
                        { 
                            label: 'Geopolitics', 
                            x: -200, 
                            y: -200,
                            children: [
                                { label: 'International Relations', x: -250, y: -230 },
                                { label: 'Power Dynamics', x: -240, y: -190 }
                            ]
                        },
                        { label: 'Theory', x: -100, y: -220 },
                        { 
                            label: 'Economics', 
                            x: -180, 
                            y: -100,
                            children: [
                                { label: 'Macroeconomics', x: -230, y: -80 },
                                { label: 'Microeconomics', x: -210, y: -120 }
                            ]
                        }
                    ]
                },
                {
                    id: 'science',
                    label: 'Science',
                    x: 150,
                    y: 150,
                    color: '#8B5CF6',
                    size: BASE_SIZE,
                    children: [
                        { 
                            label: 'Physics', 
                            x: 100, 
                            y: 200,
                            children: [
                                { label: 'Quantum Mechanics', x: 70, y: 230 },
                                { label: 'Relativity', x: 110, y: 240 },
                                { label: 'Thermodynamics', x: 90, y: 260 }
                            ]
                        },
                        { label: 'Biology', x: 200, y: 180 },
                        { label: 'Chemistry', x: 180, y: 100 },
                        { 
                            label: 'Mathematics', 
                            x: 120, 
                            y: 120,
                            children: [
                                { label: 'Calculus', x: 80, y: 100 },
                                { label: 'Linear Algebra', x: 100, y: 80 },
                                { label: 'Statistics', x: 140, y: 90 }
                            ]
                        }
                    ]
                },
                {
                    id: 'business',
                    label: 'Business',
                    x: 50,
                    y: -200,
                    color: '#EC4899',
                    size: BASE_SIZE - 3,
                    children: [
                        { 
                            label: 'Startups', 
                            x: 0, 
                            y: -250,
                            children: [
                                { label: 'Product-Market Fit', x: -40, y: -280 },
                                { label: 'Fundraising', x: 20, y: -290 },
                                { label: 'Scaling', x: -10, y: -310 }
                            ]
                        },
                        { label: 'Strategy', x: 100, y: -240 },
                        { label: 'Product', x: 80, y: -160 }
                    ]
                }
            ];

            // Create nodes recursively
            const createNode = (nodeData, parent = null, level = 0) => {
                const node = {
                    id: nodeData.id || `${parent?.id || 'root'}-${nodeData.label.toLowerCase().replace(/\s+/g, '-')}`,
                    label: nodeData.label,
                    x: nodeData.x,
                    y: nodeData.y,
                    vx: 0,
                    vy: 0,
                    color: nodeData.color || (parent?.color || '#666'),
                    size: nodeData.size || (parent ? parent.size * SIZE_REDUCTION : 20),
                    level: level,
                    isMain: level === 0,
                    parent: parent,
                    connections: []
                };
                
                this.nodes.push(node);
                
                // Connect to parent
                if (parent) {
                    this.connections.push({
                        from: parent,
                        to: node,
                        strength: 1 - (level * 0.2)
                    });
                }
                
                // Process children recursively
                if (nodeData.children) {
                    nodeData.children.forEach(child => {
                        createNode(child, node, level + 1);
                    });
                }
                
                return node;
            };

            // Create all domain nodes
            domains.forEach(domain => createNode(domain));

            // Add cross-domain connections
            this.addConnection('philosophy', 'technology', 0.5);
            this.addConnection('philosophy', 'politics', 0.7);
            this.addConnection('technology', 'science', 0.8);
            this.addConnection('politics', 'history', 0.6);
            this.addConnection('business', 'technology', 0.9);
            this.addConnection('science', 'philosophy', 0.4);
        }

        addConnection(fromId, toId, strength) {
            const from = this.nodes.find(n => n.id === fromId);
            const to = this.nodes.find(n => n.id === toId);
            if (from && to) {
                this.connections.push({ from, to, strength });
                from.connections.push(to);
                to.connections.push(from);
            }
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.centerX = this.canvas.width / 2;
            this.centerY = this.canvas.height / 2;
        }

        bindEvents() {
            window.addEventListener('resize', () => this.resize());
            
            this.canvas.addEventListener('mousemove', (e) => {
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
                
                if (this.isDragging && this.draggedNode) {
                    const worldPos = this.screenToWorld(this.mouse.x, this.mouse.y);
                    this.draggedNode.x = worldPos.x;
                    this.draggedNode.y = worldPos.y;
                }
                
                this.updateHoveredNode();
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (this.hoveredNode) {
                    this.isDragging = true;
                    this.draggedNode = this.hoveredNode;
                }
            });

            this.canvas.addEventListener('mouseup', () => {
                this.isDragging = false;
                this.draggedNode = null;
            });

            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.camera.zoom *= delta;
                this.camera.zoom = Math.max(0.5, Math.min(2, this.camera.zoom));
            });
        }

        screenToWorld(x, y) {
            return {
                x: (x - this.centerX) / this.camera.zoom - this.camera.x,
                y: (y - this.centerY) / this.camera.zoom - this.camera.y
            };
        }

        worldToScreen(x, y) {
            return {
                x: (x + this.camera.x) * this.camera.zoom + this.centerX,
                y: (y + this.camera.y) * this.camera.zoom + this.centerY
            };
        }

        updateHoveredNode() {
            const worldMouse = this.screenToWorld(this.mouse.x, this.mouse.y);
            this.hoveredNode = null;
            
            for (const node of this.nodes) {
                const dx = node.x - worldMouse.x;
                const dy = node.y - worldMouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < node.size) {
                    this.hoveredNode = node;
                    this.showTooltip(node);
                    break;
                }
            }
            
            if (!this.hoveredNode && this.tooltip) {
                this.tooltip.style.opacity = '0';
            }
        }

        showTooltip(node) {
            if (!this.tooltip) return;
            
            const screenPos = this.worldToScreen(node.x, node.y);
            this.tooltip.style.left = screenPos.x + 'px';
            this.tooltip.style.top = (screenPos.y - node.size - 10) + 'px';
            this.tooltip.textContent = node.label;
            this.tooltip.style.opacity = '1';
        }

        update() {
            // Apply physics
            const damping = 0.95;
            const repulsion = 100;
            const attraction = 0.001;
            
            // Repel nodes from each other
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const node1 = this.nodes[i];
                    const node2 = this.nodes[j];
                    
                    const dx = node2.x - node1.x;
                    const dy = node2.y - node1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0 && dist < 200) {
                        const force = repulsion / (dist * dist);
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        
                        node1.vx -= fx;
                        node1.vy -= fy;
                        node2.vx += fx;
                        node2.vy += fy;
                    }
                }
            }
            
            // Attract connected nodes
            for (const connection of this.connections) {
                const dx = connection.to.x - connection.from.x;
                const dy = connection.to.y - connection.from.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    const force = dist * attraction * connection.strength;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    
                    connection.from.vx += fx;
                    connection.from.vy += fy;
                    connection.to.vx -= fx;
                    connection.to.vy -= fy;
                }
            }
            
            // Update positions
            for (const node of this.nodes) {
                if (node !== this.draggedNode) {
                    node.vx *= damping;
                    node.vy *= damping;
                    node.x += node.vx;
                    node.y += node.vy;
                }
            }
        }

        draw() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.save();
            this.ctx.translate(this.centerX, this.centerY);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(this.camera.x, this.camera.y);
            
            // Draw connections
            this.ctx.strokeStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--text-secondary');
            
            for (const connection of this.connections) {
                this.ctx.globalAlpha = 0.1 + (0.2 * connection.strength);
                this.ctx.beginPath();
                this.ctx.moveTo(connection.from.x, connection.from.y);
                this.ctx.lineTo(connection.to.x, connection.to.y);
                this.ctx.lineWidth = Math.max(0.5, connection.strength * 2);
                this.ctx.stroke();
            }
            
            // Draw nodes
            this.ctx.globalAlpha = 1;
            
            // Sort nodes by level (draw higher levels last)
            const sortedNodes = [...this.nodes].sort((a, b) => a.level - b.level);
            
            for (const node of sortedNodes) {
                // Node circle
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                this.ctx.fillStyle = node.color;
                this.ctx.globalAlpha = node === this.hoveredNode ? 1 : (0.8 - node.level * 0.1);
                this.ctx.fill();
                
                if (node === this.hoveredNode) {
                    this.ctx.strokeStyle = node.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                }
                
                // Node label (show labels based on level and size)
                if (node.level <= 1 || (node.level === 2 && node.size > 15) || node === this.hoveredNode) {
                    this.ctx.fillStyle = getComputedStyle(document.documentElement)
                        .getPropertyValue('--text-primary');
                    const fontSize = Math.max(10, 14 * (node.size / 40));
                    this.ctx.font = `${fontSize}px Inter, sans-serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.globalAlpha = node === this.hoveredNode ? 1 : (1 - node.level * 0.2);
                    this.ctx.fillText(node.label, node.x, node.y);
                }
            }
            
            this.ctx.restore();
        }

        animate() {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.animate());
        }
    }

    // Initialize knowledge map
    window.initKnowledgeMap = function() {
        const canvas = document.getElementById('knowledge-canvas');
        if (!canvas || canvas.knowledgeMap) return;
        
        const map = new KnowledgeMap(canvas);
        canvas.knowledgeMap = map;
        map.animate();
    };
})(); 