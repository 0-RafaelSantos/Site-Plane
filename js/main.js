import { initPlane3D, updatePlaneOnScroll } from './plane3d.js';

// 1. FORÇAR VOLTAR AO INÍCIO NO REFRESH
if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

const mainWindow = document.getElementById('main-window');
const plane = document.getElementById('plane');
const bgTitle = document.getElementById('bg-title');

initPlane3D();

// js/main.js

window.addEventListener('scroll', () => {
  const scroll = window.scrollY;
  const vh = window.innerHeight;

  // FASE 1: JANELA
  const progress1 = Math.min(scroll / vh, 1);
  mainWindow.style.transform = `scale(${1 + progress1 * 12})`;
  mainWindow.style.opacity = `${1 - progress1 * 1.5}`;

  // FASE 2: AVIÃO (Margem de segurança de 1.1vh)
  const progress2 = Math.max(0, (scroll - vh * 1.1) / (vh * 4)); 

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


});