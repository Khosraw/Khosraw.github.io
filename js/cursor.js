// Custom Cursor Logic
document.addEventListener('DOMContentLoaded', () => {
    // Don't run on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) {
        document.body.style.cursor = 'default';
        return;
    }

    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    document.body.appendChild(cursorDot);

    const cursorOutline = document.createElement('div');
    cursorOutline.className = 'cursor-outline';
    document.body.appendChild(cursorOutline);

    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;

    // Cursor following logic
    document.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
    });
    
    const animateOutline = () => {
        outlineX += (mouseX - outlineX) * 0.1;
        outlineY += (mouseY - outlineY) * 0.1;
        cursorOutline.style.left = `${outlineX}px`;
        cursorOutline.style.top = `${outlineY}px`;
        requestAnimationFrame(animateOutline);
    }
    animateOutline();

    // Click animation logic
    document.addEventListener('mousedown', e => {
        cursorOutline.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        const clickAnimation = document.createElement('div');
        clickAnimation.className = 'click-animation';
        clickAnimation.style.left = `${e.clientX}px`;
        clickAnimation.style.top = `${e.clientY}px`;
        document.body.appendChild(clickAnimation);

        clickAnimation.addEventListener('animationend', () => {
            clickAnimation.remove();
        });
    });
    
    document.addEventListener('mouseup', () => {
        cursorOutline.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    // Hover effect
    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => {
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(1.5)';
            cursorOutline.style.borderColor = 'var(--accent)';
        });
        el.addEventListener('mouseleave', () => {
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorOutline.style.borderColor = '#fff';
        });
    });
}); 