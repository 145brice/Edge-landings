// Barber Form JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('barberForm');
    const successMessage = document.getElementById('successMessage');
    const bookAnotherBtn = document.getElementById('bookAnother');
    
    // Set minimum date to today
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    
    // Form validation rules
    const validationRules = {
        firstName: {
            required: true,
            minLength: 2,
            pattern: /^[a-zA-Z\s]+$/,
            message: 'First name must be at least 2 characters and contain only letters'
        },
        lastName: {
            required: true,
            minLength: 2,
            pattern: /^[a-zA-Z\s]+$/,
            message: 'Last name must be at least 2 characters and contain only letters'
        },
        email: {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address'
        },
        phone: {
            required: true,
            pattern: /^[\+]?[1-9][\d]{0,15}$/,
            message: 'Please enter a valid phone number'
        },
        service: {
            required: true,
            message: 'Please select a service'
        },
        date: {
            required: true,
            message: 'Please select a date'
        },
        time: {
            required: true,
            message: 'Please select a time'
        },
        terms: {
            required: true,
            message: 'You must agree to the terms and conditions'
        }
    };
    
    // Real-time validation
    function validateField(fieldName, value) {
        const rules = validationRules[fieldName];
        if (!rules) return true;
        
        // Check required
        if (rules.required && (!value || value.trim() === '')) {
            return rules.message || `${fieldName} is required`;
        }
        
        // Check minimum length
        if (rules.minLength && value.length < rules.minLength) {
            return rules.message;
        }
        
        // Check pattern
        if (rules.pattern && !rules.pattern.test(value)) {
            return rules.message;
        }
        
        return null;
    }
    
    // Show error message
    function showError(field, message) {
        const formGroup = field.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        field.classList.add('error');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    // Clear error message
    function clearError(field) {
        const formGroup = field.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        field.classList.remove('error');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    
    // Add real-time validation to all form fields
    const formFields = form.querySelectorAll('input, select, textarea');
    formFields.forEach(field => {
        field.addEventListener('blur', function() {
            const fieldName = this.name;
            const value = this.type === 'checkbox' ? this.checked : this.value;
            
            if (fieldName === 'terms') {
                if (!this.checked) {
                    showError(this, validationRules[fieldName].message);
                } else {
                    clearError(this);
                }
            } else {
                const error = validateField(fieldName, value);
                if (error) {
                    showError(this, error);
                } else {
                    clearError(this);
                }
            }
        });
        
        // Clear error on input for better UX
        field.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                clearError(this);
            }
        });
    });
    
    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, ''); // Remove non-digits
        if (value.length >= 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        } else if (value.length >= 3) {
            value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
        }
        this.value = value;
    });
    
    // Date validation - prevent past dates
    dateInput.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            showError(this, 'Please select a future date');
        } else {
            clearError(this);
        }
    });
    
    // Time availability check (simplified - in real app, this would check against booked slots)
    const timeSelect = document.getElementById('time');
    timeSelect.addEventListener('change', function() {
        // Simulate checking availability
        const unavailableTimes = ['12:00', '14:00']; // Example unavailable times
        if (unavailableTimes.includes(this.value)) {
            showError(this, 'This time slot is no longer available. Please select another time.');
        } else {
            clearError(this);
        }
    });
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        const formData = new FormData(form);
        
        // Validate all required fields
        Object.keys(validationRules).forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            const value = field.type === 'checkbox' ? field.checked : field.value;
            const error = validateField(fieldName, value);
            
            if (error) {
                showError(field, error);
                isValid = false;
            } else {
                clearError(field);
            }
        });
        
        if (isValid) {
            // Simulate form submission
            submitForm(formData);
        } else {
            // Scroll to first error
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
    
    // Simulate form submission
    function submitForm(formData) {
        // Show loading state
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking Appointment...';
        submitBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            // Hide form and show success message
            form.style.display = 'none';
            successMessage.style.display = 'block';
            
            // Log form data (in real app, this would be sent to server)
            console.log('Form submitted with data:');
            for (let [key, value] of formData.entries()) {
                console.log(`${key}: ${value}`);
            }
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 2000);
    }
    
    // Book another appointment
    bookAnotherBtn.addEventListener('click', function() {
        form.style.display = 'block';
        successMessage.style.display = 'none';
        form.reset();
        
        // Clear all errors
        const errorElements = form.querySelectorAll('.error-message');
        errorElements.forEach(error => {
            error.textContent = '';
            error.style.display = 'none';
        });
        
        const errorFields = form.querySelectorAll('.error');
        errorFields.forEach(field => {
            field.classList.remove('error');
        });
    });
    
    // Auto-populate time slots based on selected date (simplified)
    dateInput.addEventListener('change', function() {
        // In a real app, this would fetch available time slots from the server
        const timeSelect = document.getElementById('time');
        const selectedDate = new Date(this.value);
        const dayOfWeek = selectedDate.getDay();
        
        // Disable certain time slots on weekends (example)
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
            const earlyTimes = ['09:00', '09:30', '10:00'];
            earlyTimes.forEach(time => {
                const option = timeSelect.querySelector(`option[value="${time}"]`);
                if (option) {
                    option.disabled = true;
                    option.textContent = `${time.replace(':', ':')} AM (Weekend hours start at 10:30 AM)`;
                }
            });
        } else {
            // Re-enable all options on weekdays
            const options = timeSelect.querySelectorAll('option');
            options.forEach(option => {
                if (option.value !== '') {
                    option.disabled = false;
                    const time = option.value;
                    const displayTime = time < '12:00' ? `${time.replace(':', ':')} AM` : 
                                       time === '12:00' ? '12:00 PM' : 
                                       `${(parseInt(time.split(':')[0]) - 12)}:${time.split(':')[1]} PM`;
                    option.textContent = displayTime;
                }
            });
        }
    });
    
    // Service pricing display
    const serviceSelect = document.getElementById('service');
    const servicePrices = {
        'haircut': '$35',
        'beard-trim': '$20',
        'haircut-beard': '$50',
        'mustache-trim': '$15',
        'full-service': '$65',
        'consultation': 'Free'
    };
    
    serviceSelect.addEventListener('change', function() {
        const selectedService = this.value;
        const price = servicePrices[selectedService];
        
        if (price) {
            // Create or update price display
            let priceDisplay = document.getElementById('servicePrice');
            if (!priceDisplay) {
                priceDisplay = document.createElement('div');
                priceDisplay.id = 'servicePrice';
                priceDisplay.style.cssText = `
                    background: #e8f5e8;
                    border: 1px solid #c3e6cb;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin-top: 8px;
                    font-weight: 600;
                    color: #155724;
                    font-size: 0.9rem;
                `;
                this.parentNode.appendChild(priceDisplay);
            }
            priceDisplay.textContent = `Price: ${price}`;
        } else {
            // Remove price display
            const priceDisplay = document.getElementById('servicePrice');
            if (priceDisplay) {
                priceDisplay.remove();
            }
        }
    });
    
    // Add smooth scrolling for better UX
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add keyboard navigation support
    form.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.type !== 'submit') {
            e.preventDefault();
            const formFields = Array.from(form.querySelectorAll('input, select, textarea'));
            const currentIndex = formFields.indexOf(e.target);
            const nextField = formFields[currentIndex + 1];
            
            if (nextField) {
                nextField.focus();
            } else {
                form.querySelector('.submit-btn').click();
            }
        }
    });
    
    // Initialize form with today's date
    dateInput.value = today;
    
    console.log('Barber form initialized successfully!');
});
