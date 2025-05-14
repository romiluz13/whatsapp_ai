// Icon fallback script
document.addEventListener('DOMContentLoaded', function() {
    // Check if Font Awesome is loaded properly
    const isFontAwesomeLoaded = Array.from(document.styleSheets)
        .some(sheet => sheet.href && sheet.href.includes('font-awesome'));
        
    if (!isFontAwesomeLoaded) {
        console.log('Font Awesome not loaded, using fallback icons');
        // Add text fallbacks for each icon
        document.querySelectorAll('.card-icon').forEach(icon => {
            const iconType = icon.querySelector('i')?.className || '';
            let fallbackText = '';
            
            if (iconType.includes('reply')) fallbackText = 'SR';
            else if (iconType.includes('chart')) fallbackText = 'AC';
            else if (iconType.includes('bell')) fallbackText = 'RM';
            else if (iconType.includes('clipboard')) fallbackText = 'DD';
            else fallbackText = 'AI';
            
            icon.innerHTML = `<span style="font-weight: bold;">${fallbackText}</span>`;
        });
        
        // Replace other icons with text
        document.querySelectorAll('.logo-icon i').forEach(icon => {
            icon.parentNode.innerHTML = '<span style="font-weight: bold;">AI</span>';
        });
        
        document.querySelectorAll('.section-title i').forEach(icon => {
            icon.outerHTML = '📝';
        });
        
        document.querySelectorAll('.send-button i').forEach(icon => {
            icon.outerHTML = '→';
        });
        
        document.querySelectorAll('.fold-button i').forEach(icon => {
            icon.outerHTML = '←';
        });
        
        document.querySelectorAll('.toggle-icon i').forEach(icon => {
            icon.outerHTML = '→';
        });
        
        document.querySelectorAll('.action-button i').forEach((icon, index) => {
            const symbols = ['💡', '⚙️', 'ℹ️'];
            icon.outerHTML = symbols[index] || '•';
        });
    }
    
    // Add click handlers
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', function() {
            // Add visual active feedback
            document.querySelectorAll('.feature-card').forEach(c => 
                c.classList.remove('active'));
            this.classList.add('active');
        });
    });
}); 