import { initPlane3D, updatePlaneOnScroll } from './plane3d.js';
import { createGlobe } from './globe.js';

// 1. FORÇAR VOLTAR AO INÍCIO NO REFRESH
if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// Base de dados persistente usando localStorage
let locationsDB = [];
let locationPins = [];

// Carregar localizações do localStorage ao iniciar
function loadLocationsFromStorage() {
    const stored = localStorage.getItem('globeLocations');
    if (stored) {
        try {
            locationsDB = JSON.parse(stored);
            console.log(`Loaded ${locationsDB.length} locations from storage`);
            
            // Limpar localizações inválidas automaticamente
            cleanInvalidLocations();
        } catch (error) {
            console.error('Error loading locations from storage:', error);
            locationsDB = [];
        }
    }
}

// Guardar localizações no localStorage
function saveLocationsToStorage() {
    try {
        localStorage.setItem('globeLocations', JSON.stringify(locationsDB));
        console.log(`Saved ${locationsDB.length} locations to storage`);
    } catch (error) {
        console.error('Error saving locations to storage:', error);
    }
}

// Função para validar coordenadas
function validateCoordinates(lat, lon) {
    // Verificar se são números válidos
    if (isNaN(lat) || isNaN(lon)) {
        return false;
    }
    
    // Verificar ranges válidos
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return false;
    }
    
    // Verificar coordenadas suspeitas (muito próximas de 0,0)
    if (Math.abs(lat) < 0.1 && Math.abs(lon) < 0.1) {
        console.warn('Coordinates too close to 0,0 - possibly invalid:', lat, lon);
        return false;
    }
    
    return true;
}

// Função para limpar localizações inválidas
function cleanInvalidLocations() {
    const validLocations = locationsDB.filter(location => {
        const isValid = validateCoordinates(location.latitude, location.longitude);
        if (!isValid) {
            console.warn('Removing invalid location:', location);
        }
        return isValid;
    });
    
    if (validLocations.length !== locationsDB.length) {
        locationsDB = validLocations;
        saveLocationsToStorage();
        console.log(`Cleaned ${locationsDB.length - validLocations.length} invalid locations`);
        reloadAllPins();
    }
}

// Geocodificação - converter nome da cidade para coordenadas
async function geocodeCity(cityName) {
    try {
        // Usar Nominatim API com parâmetros melhores
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=5&addressdetails=1&extratags=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Priorizar resultados mais relevantes
            let bestResult = data[0];
            
            // Se houver múltiplos resultados, procurar o mais relevante
            if (data.length > 1) {
                bestResult = data.find(result => 
                    result.type === 'city' || 
                    result.type === 'town' ||
                    result.class === 'place'
                ) || data[0];
            }
            
            console.log('Geocoding result for', cityName, ':', bestResult);
            
            return {
                latitude: parseFloat(bestResult.lat),
                longitude: parseFloat(bestResult.lon),
                displayName: bestResult.display_name,
                importance: bestResult.importance || 0
            };
        } else {
            throw new Error('City not found');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
    }
}

// Função para adicionar localização à base de dados
async function addLocationToDB(locationData) {
    const location = {
        id: Date.now(),
        ...locationData,
        createdAt: new Date().toISOString()
    };
    
    // Se for por cidade e não tiver coordenadas ainda, fazer geocodificação
    if (locationData.searchType === 'city' && locationData.cityName && (!locationData.latitude || !locationData.longitude)) {
        try {
            const geoData = await geocodeCity(locationData.cityName);
            location.latitude = geoData.latitude;
            location.longitude = geoData.longitude;
            location.displayName = geoData.displayName;
            location.originalCityName = locationData.cityName;
        } catch (error) {
            throw new Error(`Could not find coordinates for "${locationData.cityName}". Please try with coordinates or a different city name.`);
        }
    }
    
    // Validar coordenadas
    if (!validateCoordinates(location.latitude, location.longitude)) {
        throw new Error(`Invalid coordinates: ${location.latitude}, ${location.longitude}. Please check the location and try again.`);
    }
    
    locationsDB.push(location);
    saveLocationsToStorage(); // Guardar no localStorage
    console.log('Location added to DB:', location);
    
    // Adicionar pino ao globo
    addPinToGlobe(location);
    
    return location;
}

// Função para adicionar pino ao globo
function addPinToGlobe(location) {
    if (!globeScene || !globeScene.scene) {
        console.log('Globe not ready yet, storing pin for later');
        return;
    }
    
    // Criar grupo para o pino (marker + label)
    const pinGroup = new THREE.Group();
    pinGroup.userData = { locationId: location.id, location: location };
    
    // Criar sprite com imagem do pin
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('pin.png');
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.01
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.08, 0.08, 1); // Tamanho do sprite no globo
    
    // Adicionar ao grupo (sem base)
    pinGroup.add(sprite);
    
    // Converter coordenadas para posição no globo (FÓRMULA CORRIGIDA)
    const lat = location.latitude * (Math.PI / 180); // Converter para radianos
    const lon = location.longitude * (Math.PI / 180); // Converter para radianos
    
    const radius = 0.71; // Um pouco acima da superfície do globo (globo tem 0.7 de raio)
    
    // Fórmula correta para coordenadas esféricas
    pinGroup.position.x = radius * Math.cos(lat) * Math.cos(lon);
    pinGroup.position.y = radius * Math.sin(lat);
    pinGroup.position.z = radius * Math.cos(lat) * Math.sin(lon);
    
    // Criar um objeto para manter o pino orientado corretamente
    const orientationHelper = new THREE.Object3D();
    orientationHelper.position.copy(pinGroup.position);
    orientationHelper.lookAt(0, 0, 0);
    
    // Aplicar rotação para o pino apontar para fora
    pinGroup.rotation.copy(orientationHelper.rotation);
    pinGroup.rotateX(-Math.PI / 2); // Ajustar para o cone apontar para fora
    
    // Adicionar ao earth em vez de à scene para girar com o globo
    if (globeScene.earth) {
        globeScene.earth.add(pinGroup);
    } else {
        globeScene.scene.add(pinGroup);
    }
    locationPins.push(pinGroup);
    
    console.log('Pin added to globe at:', location.latitude, location.longitude, 'Position:', pinGroup.position);
}

// Função para remover localização por ID
function removeLocation(locationId) {
    // Remover da base de dados
    const index = locationsDB.findIndex(loc => loc.id === locationId);
    if (index !== -1) {
        const removedLocation = locationsDB.splice(index, 1)[0];
        console.log('Location removed from DB:', removedLocation);
        saveLocationsToStorage();
    }
    
    // Remover pino do globo
    const pinIndex = locationPins.findIndex(pin => pin.userData.locationId === locationId);
    if (pinIndex !== -1) {
        const pin = locationPins.splice(pinIndex, 1)[0];
        if (globeScene && globeScene.earth) {
            globeScene.earth.remove(pin);
        } else if (globeScene && globeScene.scene) {
            globeScene.scene.remove(pin);
        }
        console.log('Pin removed from globe');
    }
    
    return index !== -1;
}

// Função para mostrar menu de contexto no pino
function showPinContextMenu(location, x, y) {
    // Remover menu anterior se existir
    const existingMenu = document.querySelector('.pin-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Criar menu de contexto
    const menu = document.createElement('div');
    menu.className = 'pin-context-menu';
    menu.innerHTML = `
        <div class="pin-menu-header">${location.name}</div>
        <div class="pin-menu-info">${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</div>
        <div class="pin-menu-actions">
            <button class="pin-menu-btn delete-btn" data-id="${location.id}">
                🗑️ Delete
            </button>
        </div>
    `;
    
    // Posicionar menu
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 10003;
        min-width: 200px;
        font-size: 14px;
    `;
    
    document.body.appendChild(menu);
    
    // Adicionar evento de delete
    menu.querySelector('.delete-btn').addEventListener('click', function() {
        const locationId = parseInt(this.dataset.id);
        if (removeLocation(locationId)) {
            // Mostrar mensagem de sucesso
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = 'Location deleted successfully!';
            successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: linear-gradient(135deg, #00b09b, #96c93d);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0, 176, 155, 0.3);
                z-index: 10004;
                font-weight: 600;
                opacity: 0;
                transform: translateX(-100%);
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(successMsg);
            
            // Animar entrada
            setTimeout(() => {
                successMsg.style.opacity = '1';
                successMsg.style.transform = 'translateX(0)';
            }, 100);
            
            // Remover após 3 segundos
            setTimeout(() => {
                successMsg.style.opacity = '0';
                successMsg.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.parentNode.removeChild(successMsg);
                    }
                }, 300);
            }, 3000);
        }
        menu.remove();
    });
    
    // Fechar menu ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// Função para limpar todos os pinos
function clearAllPins() {
    locationPins.forEach(pin => {
        if (globeScene && globeScene.earth) {
            globeScene.earth.remove(pin);
        } else if (globeScene && globeScene.scene) {
            globeScene.scene.remove(pin);
        }
    });
    locationPins = [];
}

// Função para recarregar todos os pinos da base de dados
function reloadAllPins() {
    if (!globeScene) return;
    
    // Limpar pinos existentes
    clearAllPins();
    
    // Adicionar todos os pinos da base de dados
    locationsDB.forEach(location => {
        addPinToGlobe(location);
    });
    
    console.log(`Reloaded ${locationsDB.length} pins on globe`);
}

// Função para ver todas as localizações (debug)
function viewAllLocations() {
    console.log('=== LOCATIONS DATABASE ===');
    console.log(`Total locations: ${locationsDB.length}`);
    locationsDB.forEach((location, index) => {
        console.log(`${index + 1}. ${location.name} (${location.latitude}, ${location.longitude}) - ${location.category}`);
    });
}

// Exportar funções para uso no modal.js
window.addLocationToDB = addLocationToDB;
window.clearAllPins = clearAllPins;
window.viewAllLocations = viewAllLocations;
window.removeLocation = removeLocation;
window.showPinContextMenu = showPinContextMenu;
window.cleanInvalidLocations = cleanInvalidLocations;

// Comandos de debug
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+C: Limpar localizações inválidas
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        cleanInvalidLocations();
        console.log(' Cleaned invalid locations');
    }
    
    // Ctrl+Shift+V: Validar todas as localizações
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        console.log(' Validating all locations:');
        locationsDB.forEach((location, index) => {
            const isValid = validateCoordinates(location.latitude, location.longitude);
            console.log(`${index + 1}. ${location.name}: ${location.latitude}, ${location.longitude} - ${isValid ? '' : ''}`);
        });
    }
});

const mainWindow = document.getElementById('main-window');
const plane = document.getElementById('plane');

const bgTitle = document.getElementById('bg-title');
const header = document.querySelector('header');


initPlane3D();

// Carregar localizações do localStorage ao iniciar
loadLocationsFromStorage();

// Criar container para o globo
const globeContainer = document.createElement('div');
globeContainer.id = 'globe-container';
globeContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; opacity: 0; pointer-events: none; background: #000;';
document.body.appendChild(globeContainer);

// Criar Estrutura do Botão
const buttonWrapper = document.createElement('div');
buttonWrapper.className = 'button-wrapper';
buttonWrapper.style.cssText = 'position: fixed; top: 30px; right: 30px; z-index: 10002; opacity: 0; visibility: hidden; transition: all 0.3s ease;';

const btn = document.createElement('button');
btn.textContent = 'Add Destination';

const blobDiv = document.createElement('div');
blobDiv.className = 'blob';

buttonWrapper.appendChild(btn);
buttonWrapper.appendChild(blobDiv);
globeContainer.appendChild(buttonWrapper);

// Adicionar evento de clique para abrir o modal
btn.addEventListener('click', function() {
    const modal = document.getElementById('locationModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevenir scroll do fundo
    // Inicializar estado do modal (cidade como padrão)
    if (window.initializeModalState) {
        window.initializeModalState();
    }
});

// Mouse tracking
buttonWrapper.addEventListener('mousemove', (e) => {
    const rect = buttonWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    buttonWrapper.style.setProperty('--x', `${x}px`);
    buttonWrapper.style.setProperty('--y', `${y}px`);
    buttonWrapper.style.setProperty('--width', `${rect.width}px`);
    buttonWrapper.style.setProperty('--height', `${rect.height}px`);
});


// Adicionar mouse tracking para todos os elementos .inner existentes

// Inicializar globo
let globeScene = null;
let globeVisible = false;

window.addEventListener('scroll', () => {
  const scroll = window.scrollY;
  const vh = window.innerHeight;
  
  // FASE 1: JANELA
  const progress1 = Math.min(scroll / vh, 1);
  mainWindow.style.transform = `scale(${1 + progress1 * 12})`;
  mainWindow.style.opacity = `${1 - progress1 * 1.5}`;

  // FASE 2: AVIÃO (Margem de segurança de 1.1vh)
  const progress2 = Math.max(0, (scroll - vh * 1.1) / (vh * 4)); 

  // FASE 3: DIVISÃO DO GLOBO (A partir de 450vh)
  const progressGlobe = Math.max(0, (scroll - vh * 4.5) / (vh * 1.5));

  const sceneEl = document.querySelector('.scene');
  const items = document.querySelectorAll('.dest-item'); // Selecionar aqui para usar no reset

  if (progress2 > 0) {
    // 1. O avião aparece e desaparece no fim
    plane.style.opacity = progress2 < 0.8 ? 1 : 1 - (progress2 - 0.8) * 5;

    updatePlaneOnScroll(progress2);

    // 2. Título TAKE OFF: Escuro e visível
    bgTitle.style.opacity = progress2 < 0.9 ? "0.9" : "0";
    bgTitle.style.color = "#000";
    bgTitle.style.transform = `scale(${2 - progress2})`;

    // 3. Ativação dos destinos
    items.forEach((item, index) => {
      const start = index * 0.3;
      if (progress2 > start && progress2 < start + 0.25) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    sceneEl.classList.add('bright');
  } else {
    // --- RESET TOTAL ---
    
    // Esconde o avião e o título imediatamente
    plane.style.opacity = "0";
    bgTitle.style.opacity = "0";
    
    // CORREÇÃO MALDIVAS: Força todos os destinos a desaparecer no scroll para cima
    items.forEach(item => {
      item.classList.remove('active');
    });

    // CORREÇÃO FUNDO BRANCO: 
    // Removemos o 'bright' mal o utilizador saia da fase do avião (progress2 <= 0)
    // Isso garante que a janela (fase 1) tenha sempre o fundo original (escuro)
    sceneEl.classList.remove('bright');
  }

    const brandingLeft = document.querySelector('.side-branding.left');
    const brandingRight = document.querySelector('.side-branding.right');

    // progress1 controla o zoom da janela (0 a 1)
    if (progress1 > 0) {
        const moveX = progress1 * 400; // Velocidade da fuga lateral
        const fadeOut = 1 - (progress1 * 1.8); // Desaparece um pouco antes do avião chegar

        // Mantemos a posição vertical definida no CSS e apenas mexemos no X
        brandingLeft.style.transform = `translateX(-${moveX}px)`;
        brandingLeft.style.opacity = fadeOut;

        brandingRight.style.transform = `translateX(${moveX}px)`;
        brandingRight.style.opacity = fadeOut;
    } else {
        // Reset quando volta ao topo
        brandingLeft.style.transform = `translateX(0)`;
        brandingLeft.style.opacity = 1;
        brandingRight.style.transform = `translateX(0)`;
        brandingRight.style.opacity = 1;
    }

    if (progressGlobe > 0) {
        // 1. FAZER O TAKE OFF DESAPARECER TOTALMENTE
        bgTitle.style.opacity = Math.max(0, 0.9 - progressGlobe * 4); 
        bgTitle.style.pointerEvents = "none";

        // 2. ESCONDER O AVIÃO
        if (plane) plane.style.opacity = Math.max(0, 1 - progressGlobe * 3);

        // 3. ESCONDER HEADER SUAVEMENTE
        if (header) {
            header.style.opacity = Math.max(0, 1 - progressGlobe * 2);
            header.style.pointerEvents = progressGlobe > 0.5 ? 'none' : 'auto';
        }

        // 4. MOSTRAR GLOBO
        if (!globeVisible && progressGlobe > 0.1) {
            globeScene = createGlobe(globeContainer);
            globeVisible = true;
            
            // Recarregar pinos existentes se houver
            reloadAllPins();
        }

        if (globeScene && globeContainer) {
            globeContainer.style.opacity = Math.min(progressGlobe * 2, 1);
            globeContainer.style.pointerEvents = 'auto';
            
            // Mostrar botão quando o globo estiver visível
            if (progressGlobe > 0.3) {
                buttonWrapper.style.opacity = '1';
                buttonWrapper.style.visibility = 'visible';
            }
        }
    } else {
        // Esconder globo quando volta para cima
        if (globeContainer) {
            globeContainer.style.opacity = 0;
            globeContainer.style.pointerEvents = 'none';
        }
        
        // Esconder botão
        buttonWrapper.style.opacity = '0';
        buttonWrapper.style.visibility = 'hidden';
        
        // Restaurar header
        if (header) {
            header.style.opacity = 1;
            header.style.pointerEvents = 'auto';
        }
    }
});