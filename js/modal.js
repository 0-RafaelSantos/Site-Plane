// Modal functionality
document.addEventListener('DOMContentLoaded', function() {
    const addLocationBtn = document.getElementById('addLocationBtn');
    const locationModal = document.getElementById('locationModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const locationForm = document.getElementById('locationForm');

    // Open modal
    function openModal() {
        locationModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Close modal
    function closeModalFunc() {
        locationModal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
        locationForm.reset(); // Reset form
    }

    // Event listeners
    addLocationBtn.addEventListener('click', openModal);
    closeModal.addEventListener('click', closeModalFunc);
    cancelBtn.addEventListener('click', closeModalFunc);

    // Close modal when clicking outside
    locationModal.addEventListener('click', function(e) {
        if (e.target === locationModal) {
            closeModalFunc();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && locationModal.classList.contains('active')) {
            closeModalFunc();
        }
    });

    // Form submission
    locationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('locationName').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value),
            description: document.getElementById('description').value,
            category: document.getElementById('category').value
        };

        console.log('New Location Added:', formData);
        
        // Show success message (you can customize this)
        showSuccessMessage('Location added successfully!');
        
        // Close modal and reset form
        closeModalFunc();
    });

    // Success message function
    function showSuccessMessage(message) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00b09b, #96c93d);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 4px 15px rgba(0, 176, 155, 0.4);
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});
