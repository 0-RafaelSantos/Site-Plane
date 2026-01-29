// Modal functionality
document.addEventListener('DOMContentLoaded', function() {
    const locationModal = document.getElementById('locationModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const locationForm = document.getElementById('locationForm');
    const searchTypeRadios = document.querySelectorAll('input[name="searchType"]');
    const coordinatesFields = document.querySelector('.coordinates-fields');
    const cityGroup = document.querySelector('.city-group');
    const citySearchInput = document.getElementById('citySearch');
    const cityDropdown = document.getElementById('cityDropdown');

    let searchTimeout;
    let selectedCity = null;

    // Toggle between search types
    searchTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'coordinates') {
                coordinatesFields.style.display = 'grid';
                cityGroup.style.display = 'none';
                // Make coordinates required
                document.getElementById('latitude').required = true;
                document.getElementById('longitude').required = true;
                citySearchInput.required = false;
            } else {
                coordinatesFields.style.display = 'none';
                cityGroup.style.display = 'block';
                // Make city required
                document.getElementById('latitude').required = false;
                document.getElementById('longitude').required = false;
                citySearchInput.required = true;
            }
        });
    });

    // City search autocomplete
    citySearchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (query.length < 2) {
            cityDropdown.classList.remove('active');
            return;
        }

        // Clear previous timeout
        clearTimeout(searchTimeout);
        
        // Show loading
        cityDropdown.innerHTML = '<div class="loading-indicator">Searching cities...</div>';
        cityDropdown.classList.add('active');

        // Debounce search
        searchTimeout = setTimeout(async () => {
            try {
                const cities = await searchCities(query);
                displayCityResults(cities);
            } catch (error) {
                cityDropdown.innerHTML = '<div class="no-results">Error searching cities</div>';
            }
        }, 300);
    });

    // Search cities function
    async function searchCities(query) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&featuretype=city`);
        const data = await response.json();
        
        return data.map(city => ({
            name: city.name,
            displayName: city.display_name,
            country: city.display_name.split(',').pop().trim(),
            lat: parseFloat(city.lat),
            lon: parseFloat(city.lon)
        }));
    }

    // Display city results
    function displayCityResults(cities) {
        if (cities.length === 0) {
            cityDropdown.innerHTML = '<div class="no-results">No cities found</div>';
            return;
        }

        // Ordenar por relevância e prioridade
        cities.sort((a, b) => {
            // Priorizar cidades conhecidas
            const priorityCities = ['miami', 'paris', 'london', 'tokyo', 'new york', 'lisbon', 'lisboa', 'madrid', 'porto'];
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            
            // Priorizar Portugal para cidades portuguesas
            const aIsPortugal = a.country.toLowerCase().includes('portugal');
            const bIsPortugal = b.country.toLowerCase().includes('portugal');
            
            // Se ambos são Portugal, manter ordem normal
            if (aIsPortugal && bIsPortugal) {
                const aPriority = priorityCities.indexOf(aName);
                const bPriority = priorityCities.indexOf(bName);
                
                if (aPriority !== -1 && bPriority !== -1) {
                    return aPriority - bPriority;
                } else if (aPriority !== -1) {
                    return -1;
                } else if (bPriority !== -1) {
                    return 1;
                }
                return 0;
            }
            
            // Se apenas um é Portugal, dar prioridade
            if (aIsPortugal) return -1;
            if (bIsPortugal) return 1;
            
            // Para não-Portugal, usar prioridade normal
            const aPriority = priorityCities.indexOf(aName);
            const bPriority = priorityCities.indexOf(bName);
            
            if (aPriority !== -1 && bPriority !== -1) {
                return aPriority - bPriority;
            } else if (aPriority !== -1) {
                return -1;
            } else if (bPriority !== -1) {
                return 1;
            }
            
            return 0;
        });

        cityDropdown.innerHTML = cities.map((city, index) => {
            // Adicionar indicador para cidades populares e portuguesas
            const isPopular = ['miami', 'paris', 'london', 'tokyo', 'new york', 'lisbon', 'lisboa', 'madrid', 'porto'].includes(city.name.toLowerCase());
            const isPortugal = city.country.toLowerCase().includes('portugal');
            let badge = '';
            
            if (isPopular && isPortugal) {
                badge = ' ⭐🇵🇹';
            } else if (isPopular) {
                badge = ' ⭐';
            } else if (isPortugal) {
                badge = ' 🇵🇹';
            }
            
            return `
            <div class="city-item ${isPopular ? 'popular' : ''} ${isPortugal ? 'portuguese' : ''}" data-index="${index}">
                <div class="city-name">${city.name}${badge}</div>
                <div class="city-country">${city.country}</div>
                <div class="city-coords">${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}</div>
            </div>
        `;
        }).join('');

        // Add click handlers
        cityDropdown.querySelectorAll('.city-item').forEach(item => {
            item.addEventListener('click', function() {
                const index = this.dataset.index;
                selectedCity = cities[index];
                citySearchInput.value = `${selectedCity.name}, ${selectedCity.country}`;
                cityDropdown.classList.remove('active');
            });
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!citySearchInput.contains(e.target) && !cityDropdown.contains(e.target)) {
            cityDropdown.classList.remove('active');
        }
    });

    // Keyboard navigation
    citySearchInput.addEventListener('keydown', function(e) {
        const items = cityDropdown.querySelectorAll('.city-item');
        const selected = cityDropdown.querySelector('.city-item.selected');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selected) {
                selected.classList.remove('selected');
                const next = selected.nextElementSibling;
                if (next) next.classList.add('selected');
            } else if (items.length > 0) {
                items[0].classList.add('selected');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selected) {
                selected.classList.remove('selected');
                const prev = selected.previousElementSibling;
                if (prev) prev.classList.add('selected');
            } else if (items.length > 0) {
                items[items.length - 1].classList.add('selected');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selected) {
                selected.click();
            }
        } else if (e.key === 'Escape') {
            cityDropdown.classList.remove('active');
        }
    });
    
    // Open modal (já é tratado no main.js)
    
    // Close modal
    function closeModalFunc() {
        locationModal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
        locationForm.reset(); // Reset form
        selectedCity = null;
        cityDropdown.classList.remove('active');
        // Reset form display
        coordinatesFields.style.display = 'grid';
        cityGroup.style.display = 'none';
        document.getElementById('latitude').required = true;
        document.getElementById('longitude').required = true;
        citySearchInput.required = false;
    }

    // Event listeners para fechar o modal
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
    locationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = document.querySelector('.btn-submit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const formData = {
                name: document.getElementById('locationName').value,
                searchType: document.querySelector('input[name="searchType"]:checked').value
            };
            
            if (formData.searchType === 'coordinates') {
                formData.latitude = parseFloat(document.getElementById('latitude').value);
                formData.longitude = parseFloat(document.getElementById('longitude').value);
            } else {
                if (selectedCity) {
                    formData.cityName = selectedCity.displayName;
                    formData.latitude = selectedCity.lat;
                    formData.longitude = selectedCity.lon;
                } else if (citySearchInput.value.trim()) {
                    formData.cityName = citySearchInput.value.trim();
                } else {
                    throw new Error('Please select a city from the dropdown');
                }
            }
            
            formData.description = document.getElementById('description').value;
            formData.category = document.getElementById('category').value;

            // Adicionar à base de dados e ao globo (async function)
            const addedLocation = await window.addLocationToDB(formData);
            
            // Mostrar mensagem de sucesso personalizada
            showSuccessMessage(`${addedLocation.name} added to the map!`);
            
            // Close modal and reset form
            closeModalFunc();
        } catch (error) {
            // Show error message
            showErrorMessage(error.message);
        } finally {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
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

    // Error message function
    function showErrorMessage(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff4757, #ff6348);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 4px 15px rgba(255, 71, 87, 0.4);
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
});
