// FluencyFlow - Main Gallery Carousel Controller

// Utility to generate default high-tech visual patterns procedurally
function generateDefaultImage(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Cyber dark space background
    ctx.fillStyle = '#03030c';
    ctx.fillRect(0, 0, 512, 512);
    
    if (type === 'cyberpunk') {
        // glowing cyberpunk HUD circle
        const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 200);
        grad.addColorStop(0, '#ff007f');
        grad.addColorStop(0.5, '#7a00ff');
        grad.addColorStop(1, '#00f0ff');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(256, 256, 120, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner thin circle
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(256, 256, 90, 0, Math.PI * 2);
        ctx.stroke();
        
        // Crossing crosshair vectors
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(256, 40);
        ctx.lineTo(256, 472);
        ctx.moveTo(40, 256);
        ctx.lineTo(472, 256);
        ctx.stroke();
        
        // Orbit HUD particles
        ctx.fillStyle = '#ff007f';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = 256 + Math.cos(angle) * 120;
            const y = 256 + Math.sin(angle) * 120;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'neon_grid') {
        // neon matrix grid layout
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= 512; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 512);
            ctx.moveTo(0, i);
            ctx.lineTo(512, i);
            ctx.stroke();
        }
        
        // Glowing matrix digital blocks
        ctx.fillStyle = 'rgba(122, 0, 255, 0.35)';
        for (let j = 0; j < 6; j++) {
            const x = Math.floor((0.2 + 0.6 * Math.random()) * 16) * 32;
            const y = Math.floor((0.2 + 0.6 * Math.random()) * 16) * 32;
            ctx.fillRect(x, y, 32, 128);
        }
        
        // Glowing Pink junctions
        ctx.fillStyle = '#ff007f';
        for (let j = 0; j < 8; j++) {
            const x = Math.floor((0.3 + 0.4 * Math.random()) * 16) * 32 + 16;
            const y = Math.floor((0.3 + 0.4 * Math.random()) * 16) * 32 + 16;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'vortex') {
        // double spiral vortex pattern
        ctx.lineWidth = 4;
        for (let i = 0; i < 200; i++) {
            const angle = 0.08 * i;
            const r = 1.8 * i;
            const x = 256 + Math.cos(angle) * r;
            const y = 256 + Math.sin(angle) * r;
            
            const rCol = Math.floor(128 + 127 * Math.sin(0.04 * i));
            const gCol = Math.floor(128 + 127 * Math.cos(0.04 * i));
            const bCol = 255;
            
            ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
            ctx.beginPath();
            ctx.arc(x, y, 3 + i * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    return canvas.toDataURL('image/png');
}

class CarouselController {
    constructor() {
        this.images = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.playTimeout = null;
        this.currentState = 'idle'; // 'idle', 'showing_particles', 'fading_to_image', 'showing_image', 'fading_to_particles', 'transitioning'
        
        // Timing configuration (seconds)
        this.imageTime = 4.0;
        this.particleTime = 5.0;
        this.fadeTime = 1.5;
        this.spaceshipTime = 1.2;
        
        // DOM Selectors
        this.uploadZone = document.getElementById('upload-zone');
        this.imageInput = document.getElementById('image-input');
        this.imageListEl = document.getElementById('carousel-image-list');
        this.noImagesPlaceholder = document.getElementById('no-images-placeholder');
        this.imageCountBadge = document.getElementById('image-count');
        
        this.btnTogglePlay = document.getElementById('btn-toggle-play');
        this.btnPlayIcon = document.getElementById('btn-play-icon');
        this.btnPlayText = document.getElementById('btn-play-text');
        this.btnPrev = document.getElementById('btn-prev-image');
        this.btnNext = document.getElementById('btn-next-image');
        
        this.sliderImageTime = document.getElementById('slider-image-time');
        this.sliderParticleTime = document.getElementById('slider-particle-time');
        this.sliderFadeTime = document.getElementById('slider-fade-time');
        
        this.valImageTime = document.getElementById('val-image-time');
        this.valParticleTime = document.getElementById('val-particle-time');
        this.valFadeTime = document.getElementById('val-fade-time');
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.loadImages();
        this.bindEvents();
        this.renderList();
        
        // Initialize header date
        const currentDateEl = document.getElementById('current-date');
        if (currentDateEl) {
            const today = new Date();
            currentDateEl.innerText = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        
        this.updateUploadOverlayState();
        
        // Auto play first image on visualizer load
        const queue = this.getQueue();
        if (queue.length > 0) {
            this.currentIndex = 0;
            this.waitForEngineAndPlay();
        }
    }
    
    waitForEngineAndPlay() {
        if (window.visualizerEngine && window.visualizerEngine.scene) {
            this.playImage(this.currentIndex, false); // Initial load: directly morph without spaceship flight
        } else {
            setTimeout(() => this.waitForEngineAndPlay(), 100);
        }
    }
    
    getQueue() {
        return this.images
            .filter(img => img.checked)
            .sort((a, b) => a.order - b.order || a.id - b.id);
    }
    
    async playImage(queueIndex, useTransition = true) {
        const queue = this.getQueue();
        if (queue.length === 0) return;
        
        if (queueIndex < 0 || queueIndex >= queue.length) {
            queueIndex = 0;
        }
        
        this.currentIndex = queueIndex;
        const targetImage = queue[queueIndex];
        
        // Interrupt active transitions and animations safely
        this.interrupt();
        this.currentState = 'transitioning';
        
        this.highlightActiveCard(targetImage.id);
        
        try {
            if (useTransition) {
                // Spaceship animation transition flow
                // 1. Build and downsample target positions/colors
                await window.visualizerEngine.loadImageAndConvert(targetImage.url);
                
                // Keep photoCard hidden & particle system fully visible initially
                window.visualizerEngine.photoCard.material.opacity = 0.0;
                window.visualizerEngine.particleSystem.material.opacity = 0.95;
                
                // 2. Play flight transition (morph triggers automatically halfway)
                await window.visualizerEngine.playSpaceshipTransition(this.spaceshipTime);
            } else {
                // Direct morphing (No flight, for initial loads)
                await window.visualizerEngine.loadImageAndConvert(targetImage.url);
                window.visualizerEngine.photoCard.material.opacity = 0.0;
                window.visualizerEngine.particleSystem.material.opacity = 0.95;
                await window.visualizerEngine.triggerMorphAnimation();
            }
            
            this.currentState = 'showing_particles';
            
            // Wait in interactive particle state
            this.playTimeout = setTimeout(() => {
                this.fadeToImageState();
            }, this.particleTime * 1000);
            
        } catch (err) {
            console.error("Error playing gallery image:", err);
        }
    }
    
    async fadeToImageState() {
        this.currentState = 'fading_to_image';
        
        // Smoothly cross fade: Image in, Particles out (down to 0.1 for subtle backdrop shimmer)
        const imgFade = window.visualizerEngine.fadeToImage(1.0, this.fadeTime);
        const partFade = window.visualizerEngine.fadeParticles(0.1, this.fadeTime);
        
        await Promise.all([imgFade, partFade]);
        
        this.currentState = 'showing_image';
        
        this.playTimeout = setTimeout(() => {
            this.fadeToParticlesState();
        }, this.imageTime * 1000);
    }
    
    async fadeToParticlesState() {
        this.currentState = 'fading_to_particles';
        
        // Smoothly cross fade: Image out, Particles in
        const imgFade = window.visualizerEngine.fadeToImage(0.0, this.fadeTime);
        const partFade = window.visualizerEngine.fadeParticles(0.95, this.fadeTime);
        
        await Promise.all([imgFade, partFade]);
        
        this.currentState = 'showing_particles_post';
        
        if (this.isPlaying) {
            this.playNext(true);
        }
    }
    
    playNext(useTransition = true) {
        const queue = this.getQueue();
        if (queue.length === 0) return;
        let nextIdx = this.currentIndex + 1;
        if (nextIdx >= queue.length) {
            nextIdx = 0;
        }
        this.playImage(nextIdx, useTransition);
    }
    
    playPrev(useTransition = true) {
        const queue = this.getQueue();
        if (queue.length === 0) return;
        let prevIdx = this.currentIndex - 1;
        if (prevIdx < 0) {
            prevIdx = queue.length - 1;
        }
        this.playImage(prevIdx, useTransition);
    }
    
    interrupt() {
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }
        
        if (window.visualizerEngine) {
            gsap.killTweensOf(window.visualizerEngine.camera.position);
            
            if (window.visualizerEngine.photoCard && window.visualizerEngine.photoCard.material) {
                gsap.killTweensOf(window.visualizerEngine.photoCard.material);
            }
            if (window.visualizerEngine.particleSystem && window.visualizerEngine.particleSystem.material) {
                gsap.killTweensOf(window.visualizerEngine.particleSystem.material);
            }
            if (window.visualizerEngine.transition) {
                gsap.killTweensOf(window.visualizerEngine.transition);
            }
            if (window.visualizerEngine.spaceshipState) {
                gsap.killTweensOf(window.visualizerEngine.spaceshipState);
            }
            // Clear spaceship transition state
            window.visualizerEngine.isSpaceshipActive = false;
            window.visualizerEngine.spaceshipIndices = null;
        }
    }
    
    resumeTimer() {
        if (this.playTimeout) clearTimeout(this.playTimeout);
        
        if (this.currentState === 'showing_particles') {
            this.playTimeout = setTimeout(() => {
                this.fadeToImageState();
            }, this.particleTime * 1000);
        } else if (this.currentState === 'showing_image') {
            this.playTimeout = setTimeout(() => {
                this.fadeToParticlesState();
            }, this.imageTime * 1000);
        }
    }
    
    // File inputs & Drag and Drop operations
    async handleFiles(files) {
        let addedAny = false;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            
            try {
                const base64Url = await this.fileToBase64(file);
                const newImg = {
                    id: Date.now() + i,
                    name: file.name,
                    url: base64Url,
                    checked: true,
                    order: this.images.length > 0 ? Math.max(...this.images.map(img => img.order)) + 1 : 1
                };
                this.images.push(newImg);
                addedAny = true;
            } catch (err) {
                console.error("Error reading uploaded file:", err);
            }
        }
        
        if (addedAny) {
            this.images.sort((a, b) => a.order - b.order || a.id - b.id);
            this.saveImages();
            this.renderList();
            this.updateUploadOverlayState();
            
            const queue = this.getQueue();
            if (this.currentIndex === -1 && queue.length > 0) {
                this.playImage(0, true);
            }
        }
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    bindEvents() {
        // Drag and drop events
        ['dragenter', 'dragover'].forEach(name => {
            this.uploadZone.addEventListener(name, (e) => {
                e.preventDefault();
                this.uploadZone.style.background = 'rgba(0, 240, 255, 0.12)';
                this.uploadZone.style.borderColor = 'var(--accent-blue)';
            });
        });
        
        ['dragleave', 'drop'].forEach(name => {
            this.uploadZone.addEventListener(name, (e) => {
                e.preventDefault();
                this.uploadZone.style.background = 'rgba(10, 9, 20, 0.7)';
                this.uploadZone.style.borderColor = 'var(--border-glass)';
            });
        });
        
        this.uploadZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) this.handleFiles(files);
        });
        
        this.imageInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length) this.handleFiles(files);
        });
        
        // Auto Play toggle
        this.btnTogglePlay.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            this.updatePlayButtonUI();
            
            if (this.isPlaying) {
                if (this.currentState === 'showing_particles_post') {
                    this.playNext(true);
                } else if (this.currentState === 'idle') {
                    this.playImage(0, true);
                } else {
                    this.resumeTimer();
                }
            } else {
                if (this.playTimeout) {
                    clearTimeout(this.playTimeout);
                    this.playTimeout = null;
                }
            }
        });
        
        // Manual button triggers
        this.btnPrev.addEventListener('click', () => this.playPrev(true));
        this.btnNext.addEventListener('click', () => this.playNext(true));
        
        // Time Sliders
        this.sliderImageTime.addEventListener('input', (e) => {
            this.imageTime = parseFloat(e.target.value);
            this.valImageTime.innerText = `${this.imageTime}s`;
            localStorage.setItem('fluency_image_time', this.imageTime);
        });
        
        this.sliderParticleTime.addEventListener('input', (e) => {
            this.particleTime = parseFloat(e.target.value);
            this.valParticleTime.innerText = `${this.particleTime}s`;
            localStorage.setItem('fluency_particle_time', this.particleTime);
        });
        
        this.sliderFadeTime.addEventListener('input', (e) => {
            this.fadeTime = parseFloat(e.target.value);
            this.valFadeTime.innerText = `${this.fadeTime}s`;
            localStorage.setItem('fluency_fade_time', this.fadeTime);
        });
    }
    
    renderList() {
        this.imageListEl.innerHTML = '';
        
        if (this.images.length === 0) {
            this.noImagesPlaceholder.classList.remove('hidden');
            this.imageCountBadge.innerText = '0 张';
            return;
        }
        
        this.noImagesPlaceholder.classList.add('hidden');
        this.imageCountBadge.innerText = `${this.images.length} 张`;
        
        const queue = this.getQueue();
        const activeQueueItem = queue[this.currentIndex];
        
        this.images.forEach((img) => {
            const isActive = activeQueueItem && activeQueueItem.id === img.id;
            
            const card = document.createElement('div');
            card.className = `carousel-item-card ${isActive ? 'active' : ''}`;
            card.dataset.id = img.id;
            
            card.innerHTML = `
                <input type="checkbox" class="card-checkbox" ${img.checked ? 'checked' : ''} title="勾选加入轮播">
                <div class="card-thumbnail-box">
                    <img src="${img.url}" alt="${img.name}">
                </div>
                <div class="card-info-box">
                    <div class="card-title" title="${img.name}">${img.name}</div>
                    <div class="card-meta">ID: ${img.id.toString().slice(-6)}</div>
                </div>
                <div class="card-order-box">
                    <span>顺序</span>
                    <input type="number" class="order-input" value="${img.order}" min="1" step="1" title="轮播播放顺序">
                </div>
                <button class="btn-remove-card" title="从画廊删除">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            
            // Manual Card Click Trigger Playback
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-checkbox') || e.target.closest('.order-input') || e.target.closest('.btn-remove-card')) {
                    return;
                }
                const currentQueue = this.getQueue();
                const qIdx = currentQueue.findIndex(q => q.id === img.id);
                if (qIdx !== -1) {
                    this.playImage(qIdx, true);
                } else {
                    alert("请先勾选该图片加入轮播序列后再进行播放。");
                }
            });
            
            // Checkbox changes
            const checkbox = card.querySelector('.card-checkbox');
            checkbox.addEventListener('change', () => {
                img.checked = checkbox.checked;
                this.saveImages();
                this.renderList();
                this.adjustQueueIndexAfterEdit();
            });
            
            // Play Order changes
            const orderInput = card.querySelector('.order-input');
            orderInput.addEventListener('change', () => {
                let val = parseInt(orderInput.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                img.order = val;
                this.images.sort((a, b) => a.order - b.order || a.id - b.id);
                this.saveImages();
                this.renderList();
                this.adjustQueueIndexAfterEdit();
            });
            
            // Remove picture
            const removeBtn = card.querySelector('.btn-remove-card');
            removeBtn.addEventListener('click', () => {
                this.deleteImage(img.id);
            });
            
            this.imageListEl.appendChild(card);
        });
    }
    
    adjustQueueIndexAfterEdit() {
        const queue = this.getQueue();
        if (queue.length === 0) {
            this.currentIndex = -1;
            this.interrupt();
            if (window.visualizerEngine) {
                window.visualizerEngine.generateDefaultSphere();
                window.visualizerEngine.photoCard.material.opacity = 0.0;
                window.visualizerEngine.particleSystem.material.opacity = 0.95;
            }
            this.updateUploadOverlayState();
            return;
        }
        
        const activeCard = this.imageListEl.querySelector('.carousel-item-card.active');
        if (activeCard) {
            const activeId = parseInt(activeCard.dataset.id, 10);
            const idx = queue.findIndex(q => q.id === activeId);
            if (idx !== -1) {
                this.currentIndex = idx;
            } else {
                this.playImage(0, true);
            }
        } else {
            this.currentIndex = 0;
            this.playImage(0, true);
        }
    }
    
    updateUploadOverlayState() {
        if (this.images.length > 0) {
            this.uploadZone.classList.add('hidden');
        } else {
            this.uploadZone.classList.remove('hidden');
        }
    }
    
    loadImages() {
        let loaded = [];
        try {
            const data = localStorage.getItem('fluency_carousel_images');
            if (data) loaded = JSON.parse(data);
        } catch (e) {
            console.error("Failed to parse localStorage carousel images:", e);
        }
        
        if (loaded && loaded.length > 0) {
            this.images = loaded;
        } else {
            this.images = [
                {
                    id: 1001,
                    name: 'Cyberpunk HUD.png',
                    url: generateDefaultImage('cyberpunk'),
                    checked: true,
                    order: 1
                },
                {
                    id: 1002,
                    name: 'Neon Matrix Grid.png',
                    url: generateDefaultImage('neon_grid'),
                    checked: true,
                    order: 2
                },
                {
                    id: 1003,
                    name: 'Cosmic Vortex.png',
                    url: generateDefaultImage('vortex'),
                    checked: true,
                    order: 3
                }
            ];
            this.saveImages();
        }
    }
    
    saveImages() {
        try {
            localStorage.setItem('fluency_carousel_images', JSON.stringify(this.images));
        } catch (e) {
            console.warn("Storage quota exceeded. Temporary saving to memory session only.", e);
        }
    }
    
    loadSettings() {
        this.imageTime = parseFloat(localStorage.getItem('fluency_image_time')) || 4.0;
        this.particleTime = parseFloat(localStorage.getItem('fluency_particle_time')) || 5.0;
        this.fadeTime = parseFloat(localStorage.getItem('fluency_fade_time')) || 1.5;
        
        this.sliderImageTime.value = this.imageTime;
        this.valImageTime.innerText = `${this.imageTime}s`;
        
        this.sliderParticleTime.value = this.particleTime;
        this.valParticleTime.innerText = `${this.particleTime}s`;
        
        this.sliderFadeTime.value = this.fadeTime;
        this.valFadeTime.innerText = `${this.fadeTime}s`;
    }
    
    updatePlayButtonUI() {
        if (this.isPlaying) {
            this.btnTogglePlay.classList.add('playing');
            this.btnPlayIcon.className = 'fa-solid fa-pause';
            this.btnPlayText.innerText = '暂停轮播';
        } else {
            this.btnTogglePlay.classList.remove('playing');
            this.btnPlayIcon.className = 'fa-solid fa-play';
            this.btnPlayText.innerText = '自动播放';
        }
    }
    
    highlightActiveCard(imageId) {
        const cards = this.imageListEl.querySelectorAll('.carousel-item-card');
        cards.forEach(card => {
            if (parseInt(card.dataset.id, 10) === imageId) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }
    
    deleteImage(imageId) {
        this.images = this.images.filter(img => img.id !== imageId);
        this.saveImages();
        this.renderList();
        this.updateUploadOverlayState();
        this.adjustQueueIndexAfterEdit();
    }
}

// Start Main Controller when DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.carouselController = new CarouselController();
});
