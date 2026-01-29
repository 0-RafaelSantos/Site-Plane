import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createGlobe(container) {
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.z = 2.5;

    // Renderer - Melhor qualidade sem shadows
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar para performance
    renderer.shadowMap.enabled = false; // Desativar shadows para remover artefactos
    container.appendChild(renderer.domElement);

    // Controls - Apenas rotação, sem zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false; // Desativar zoom
    controls.minDistance = 2.5; // Fixo
    controls.maxDistance = 2.5; // Fixo
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.autoRotate = false; // Desativar rotação automática para controlo manual

    // Sem iluminação - apenas luz ambiente muito baixa
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // Mínimo possível
    scene.add(ambientLight);
    
    // Earth Geometry - Mais detalhe
    const geometry = new THREE.SphereGeometry(0.7, 128, 128);

    // Texture com cores melhoradas
    const textureLoader = new THREE.TextureLoader();
    const continentsTexture = textureLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
        (texture) => {
            console.log('Realistic texture loaded successfully');
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.colorSpace = THREE.SRGBColorSpace; // Melhor cor
            material.map = texture;
            material.needsUpdate = true;
        },
        undefined,
        (error) => {
            console.warn('Texture loading failed, using fallback');
            // Fallback com cores melhores
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Gradiente mais realista para oceanos
            const oceanGradient = ctx.createLinearGradient(0, 0, 0, 512);
            oceanGradient.addColorStop(0, '#006994');
            oceanGradient.addColorStop(0.5, '#0099cc');
            oceanGradient.addColorStop(1, '#003d5c');
            ctx.fillStyle = oceanGradient;
            ctx.fillRect(0, 0, 1024, 512);
            
            // Adicionar continentes simplificados
            ctx.fillStyle = '#2d5016';
            // África/Europa
            ctx.fillRect(480, 180, 120, 200);
            // Américas
            ctx.fillRect(200, 200, 150, 250);
            // Ásia
            ctx.fillRect(600, 150, 200, 180);
            
            material.map = new THREE.CanvasTexture(canvas);
            material.needsUpdate = true;
        }
    );
    
    const material = new THREE.MeshBasicMaterial({
        map: continentsTexture,
        transparent: false,
        opacity: 1.0,
        side: THREE.FrontSide
    });

    const earth = new THREE.Mesh(geometry, material);
    earth.castShadow = false; // Desativar completamente
    earth.receiveShadow = false; // Desativar completamente
    scene.add(earth);

    // Glow effect mais suave
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.03,
        side: THREE.BackSide
    });


    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 64, 64),
        glowMaterial
    );
    scene.add(glow);

    // Animation loop
    let animationId;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        // Rotação muito lenta apenas se não estiver a interagir
        if (!controls.autoRotate) {
            earth.rotation.y += 0.0002;
            glow.rotation.y += 0.0002;
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Raycasting para detectar cliques nos pinos
    container.addEventListener('click', function(event) {
        // Calcular posição do mouse em coordenadas normalizadas (-1 a +1)
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Atualizar raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Obter todos os pinos (filhos do earth)
        const pins = [];
        earth.traverse(function(child) {
            if (child.userData && child.userData.locationId) {
                pins.push(child);
            }
        });
        
        console.log('Pins found for raycasting:', pins.length);
        
        // Verificar interseções
        const intersects = raycaster.intersectObjects(pins, true); // true para recursive
        
        console.log('Raycaster intersects:', intersects.length);
        
        if (intersects.length > 0) {
            let clickedPin = intersects[0].object;
            
            // Se o objeto clicado não tiver userData, procurar no parent
            while (clickedPin && !clickedPin.userData.locationId) {
                clickedPin = clickedPin.parent;
            }
            
            if (clickedPin && clickedPin.userData.location) {
                const location = clickedPin.userData.location;
                console.log('Pin clicked:', location.name);
                
                // Mostrar menu de contexto
                if (window.showPinContextMenu) {
                    window.showPinContextMenu(location, event.clientX, event.clientY);
                }
            }
        }
    });

    // Resize handler
    const handleResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup function
    const cleanup = () => {
        window.removeEventListener('resize', handleResize);
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        renderer.dispose();
        container.removeChild(renderer.domElement);
    };

    return { 
        scene, 
        camera, 
        renderer, 
        controls, 
        earth, 
        glow,
        cleanup 
    };
}