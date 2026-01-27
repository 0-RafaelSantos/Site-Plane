// js/plane3d.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, planeModel;

export function initPlane3D() {
    const canvas = document.getElementById('plane-canvas');
    scene = new THREE.Scene();

    // Câmara no topo olhando para baixo
    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 25, 0); // Subi a câmara para 25 para dar mais campo de visão
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, // Essencial para transparência
      antialias: true 
  });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const loader = new GLTFLoader();
    loader.load('Jet.glb', (gltf) => {
        planeModel = gltf.scene;
      
        planeModel.traverse((node) => {
        if (node.isMesh) {
            
            node.material.color.setHex(0xADD8E6); // Exemplo: Amarelo vibrante
            
            // Opcional: Tornar o material mais brilhante/metálico
            if (node.material.metalness !== undefined) node.material.metalness = 0.5;
            if (node.material.roughness !== undefined) node.material.roughness = 0.2;
          }
      });
        // Centralização

        const box = new THREE.Box3().setFromObject(planeModel);
        const center = box.getCenter(new THREE.Vector3());
        planeModel.position.sub(center); 
        
        // ROTAÇÃO PARA CORRIGIR O SENTIDO (Bico para o topo)
        // Se ele ainda aparecer ao contrário, experimenta 0 ou Math.PI * 2
        planeModel.rotation.y = Math.PI; 

        const size = box.getSize(new THREE.Vector3());
        const scaleFactor = 15 / size.x; 
        planeModel.scale.setScalar(scaleFactor);

        scene.add(planeModel);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

export function updatePlaneOnScroll(progress) {
    if (!planeModel) return;

    if (progress < 0.2) {
        const trackProgress = progress / 0.2;
        planeModel.position.z = -trackProgress * 5; 
        planeModel.position.y = 0; // Mantém no chão na pista
    } 
    else {
        const takeOff = (progress - 0.2) / 0.8;

        // Distância percorrida (Z)
        planeModel.position.z = -5 - (takeOff * 50); 
        
        // Altitude (Y) - Ajustado para o novo tamanho
        planeModel.position.y = takeOff * 12; 

        // Inclinação
        planeModel.rotation.x = -takeOff * 0.5;
    }
}