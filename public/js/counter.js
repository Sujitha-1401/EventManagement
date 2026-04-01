// ============================================
// ANIMATED COUNTER UTILITY
// For counting up statistics with smooth easing
// ============================================

/**
 * Animates a number from 0 to target value
 * @param {HTMLElement} element - The element to animate
 * @param {number} target - The target number
 * @param {number} duration - Animation duration in milliseconds (default: 2000)
 * @param {string} suffix - Optional suffix (e.g., '+', '%')
 */
function animateCounter(element, target, duration = 2000, suffix = '') {
    const start = 0;
    const startTime = performance.now();

    // Easing function for smooth acceleration/deceleration
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);

        const current = Math.floor(start + (target - start) * easedProgress);
        element.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + suffix;
        }
    }

    requestAnimationFrame(update);
}

/**
 * Initialize all counters on page load
 * Usage: Add data-counter="100" to any element
 */
function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-counter'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = parseInt(counter.getAttribute('data-duration')) || 2000;

        // Use Intersection Observer to trigger when element is visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(counter, target, duration, suffix);
                    observer.unobserve(counter);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(counter);
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCounters);
} else {
    initCounters();
}

// Export for manual use
window.animateCounter = animateCounter;
window.initCounters = initCounters;
