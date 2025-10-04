// ========================================
// 🔧 CONFIGURATION FLAGS
// ========================================
const CONFIG = {
    // Set to false for development/demos to disable limits
    ENABLE_HOURLY_LIMITS: false,  // Change to false to disable limits
    
    // Limits (only applied if ENABLE_HOURLY_LIMITS is true)
    MAX_PHOTOS_PER_HOUR: 3,
    MAX_AI_REQUESTS_PER_HOUR: 3
};

class TakePicApp {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalPhotosGrid = document.getElementById('originalPhotosGrid');
        this.photoboothPhotosGrid = document.getElementById('photoboothPhotosGrid');
        this.notification = document.getElementById('notification');

        this.startCameraBtn = document.getElementById('startCamera');
        this.capturePhotoBtn = document.getElementById('capturePhoto');
        this.stopCameraBtn = document.getElementById('stopCamera');
        this.clearPhotosBtn = document.getElementById('clearPhotos');
        this.photoBoothBtn = document.getElementById('photoBooth');

        this.stream = null;
        this.originalPhotos = [];
        this.photoboothPhotos = [];
        this.selectedPhotoIndex = null;
        this.currentFilter = 'none';
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
        console.log('🔑 API key loaded:', this.apiKey ? '✅ Found' : '❌ Not found');
        this.genAI = null;
        
        // Usage limits for conference protection (hourly limits)
        this.limitsEnabled = CONFIG.ENABLE_HOURLY_LIMITS;
        this.maxPhotos = CONFIG.MAX_PHOTOS_PER_HOUR;
        this.maxAiRequests = CONFIG.MAX_AI_REQUESTS_PER_HOUR;
        this.initHourlyLimits();
        
        this.initEventListeners();
        this.loadPhotosFromStorage();
        this.updatePhotosGrid();
        this.updateUsageLimits();
        this.checkStorageUsage();
        this.loadNagrodaImage();
        
        // Log configuration status
        console.log('========================================');
        console.log('📸 TakePic Configuration:');
        console.log(`🔧 Hourly Limits: ${this.limitsEnabled ? '🔒 ENABLED' : '🔓 DISABLED'}`);
        if (this.limitsEnabled) {
            console.log(`📷 Max Photos: ${this.maxPhotos}/hour`);
            console.log(`🤖 Max AI: ${this.maxAiRequests}/hour`);
        } else {
            console.log('📷 Photos: ∞ (unlimited)');
            console.log('🤖 AI: ∞ (unlimited)');
        }
        console.log('========================================');
    }
    
    checkStorageUsage() {
        try {
            // Estimate localStorage usage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }
            
            // Convert to KB
            const sizeKB = Math.round(totalSize / 1024);
            const limitKB = 5120; // ~5MB typical limit
            const usagePercent = Math.round((sizeKB / limitKB) * 100);
            
            console.log(`LocalStorage usage: ${sizeKB}KB / ${limitKB}KB (${usagePercent}%)`);
            
            // Warning at 80%
            if (usagePercent > 80) {
                this.showNotification(`⚠️ Pamięć prawie pełna: ${usagePercent}%`, 'warning');
            }
            
        } catch (error) {
            console.error('Failed to check storage usage:', error);
        }
    }
    
    initHourlyLimits() {
        if (!this.limitsEnabled) {
            this.photosUsed = 0;
            this.aiRequestsUsed = 0;
            console.log('🔓 Hourly limits DISABLED - unlimited usage allowed');
            return;
        }
        
        const now = new Date();
        const currentHour = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours();
        
        // Get stored usage data
        const storedData = JSON.parse(localStorage.getItem('takepic_hourly_limits') || '{}');
        
        // If it's a new hour, reset counters
        if (storedData.hour !== currentHour) {
            this.photosUsed = 0;
            this.aiRequestsUsed = 0;
            this.currentHour = currentHour;
            this.saveHourlyLimits();
        } else {
            // Same hour, load existing counters
            this.photosUsed = storedData.photosUsed || 0;
            this.aiRequestsUsed = storedData.aiRequestsUsed || 0;
            this.currentHour = currentHour;
        }
        
        console.log(`🔒 Hourly limits ENABLED for ${currentHour}: Photos: ${this.photosUsed}/${this.maxPhotos}, AI: ${this.aiRequestsUsed}/${this.maxAiRequests}`);
    }
    
    saveHourlyLimits() {
        const data = {
            hour: this.currentHour,
            photosUsed: this.photosUsed,
            aiRequestsUsed: this.aiRequestsUsed
        };
        localStorage.setItem('takepic_hourly_limits', JSON.stringify(data));
    }
    
    initEventListeners() {
        if (this.startCameraBtn) {
            this.startCameraBtn.addEventListener('click', () => this.startCamera());
        }
        if (this.capturePhotoBtn) {
            this.capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        }
        if (this.stopCameraBtn) {
            this.stopCameraBtn.addEventListener('click', () => this.stopCamera());
        }
        if (this.clearPhotosBtn) {
            this.clearPhotosBtn.addEventListener('click', () => this.clearAllPhotos());
        }
        if (this.photoBoothBtn) {
            this.photoBoothBtn.addEventListener('click', () => this.createPhotoBooth());
        }

        // Initialize AI for PhotoBooth only
        this.initGenAI();

        window.addEventListener('beforeunload', () => {
            this.stopCamera();
        });
    }
    
    async startCamera() {
        try {
            // High resolution constraints for quality photos
            const constraints = {
                video: {
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 },
                    facingMode: 'user'
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // iOS requires play() to be called
            await this.video.play();

            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                console.log(`📐 Canvas set to ${this.video.videoWidth}x${this.video.videoHeight}`);
            };

            this.startCameraBtn.disabled = true;
            this.capturePhotoBtn.disabled = false;
            this.stopCameraBtn.disabled = false;

            const container = document.querySelector('.camera-container');
            if (container) container.classList.add('recording');
            this.showNotification('Kamera włączona!', 'success');

        } catch (error) {
            console.error('Camera error:', error);
            let errorMsg = 'Nie udało się włączyć kamery.';
            if (error.name === 'NotAllowedError') {
                errorMsg = 'Brak uprawnień do kamery. Sprawdź ustawienia.';
            } else if (error.name === 'NotFoundError') {
                errorMsg = 'Nie znaleziono kamery.';
            }
            this.showNotification(errorMsg, 'error');
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
            
            this.startCameraBtn.disabled = false;
            this.capturePhotoBtn.disabled = true;
            this.stopCameraBtn.disabled = true;
            
            document.querySelector('.camera-container').classList.remove('recording');
            this.showNotification('Kamera zatrzymana', 'info');
        }
    }
    
    capturePhoto() {
        if (!this.stream) {
            this.showNotification('Kamera nie jest włączona', 'error');
            return;
        }
        
        // Check photo limit (only if limits are enabled)
        if (this.limitsEnabled && this.photosUsed >= this.maxPhotos) {
            this.showNotification(`Limit zdjęć osiągnięty (${this.maxPhotos}/godzinę). Spróbuj ponownie za godzinę.`, 'error');
            return;
        }
        
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const dataURL = this.canvas.toDataURL('image/jpeg', 0.85);

        const photo = {
            id: Date.now(),
            data: dataURL,
            timestamp: new Date().toLocaleString('pl-PL')
        };

        this.originalPhotos.unshift(photo);

        // Keep only 3 original photos
        if (this.originalPhotos.length > 3) {
            this.originalPhotos = this.originalPhotos.slice(0, 3);
        }

        // Update selection index since we added photo at beginning
        if (this.selectedPhotoIndex !== null) {
            this.selectedPhotoIndex++;
            if (this.selectedPhotoIndex >= this.originalPhotos.length) {
                this.selectedPhotoIndex = null;
            }
        }

        // Update photo usage counter (only if limits are enabled)
        if (this.limitsEnabled) {
            this.photosUsed++;
            this.saveHourlyLimits();
        }

        this.savePhotosToStorage();
        this.updatePhotosGrid();
        this.updateUsageLimits();
        this.showNotification(`Zdjęcie zapisane! (${this.photosUsed}/${this.maxPhotos})`, 'success');

        this.animateCapture();
    }
    
    animateCapture() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            opacity: 0.8;
            z-index: 10;
            border-radius: 15px;
        `;
        
        document.querySelector('.camera-container').appendChild(overlay);
        
        setTimeout(() => {
            overlay.remove();
        }, 150);
    }
    
    updatePhotosGrid() {
        // Update original photos grid
        this.updatePhotoRow(this.originalPhotosGrid, this.originalPhotos, true, '📷');

        // Update photobooth photos grid
        this.updatePhotoRow(this.photoboothPhotosGrid, this.photoboothPhotos, false, '🎉');
    }

    updatePhotoRow(gridElement, photosArray, isSelectable, emptyIcon) {
        const photoSlots = gridElement.querySelectorAll('.photo-slot');

        photoSlots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.className = 'photo-slot';

            if (photosArray[index]) {
                // Create image container
                const imageContainer = document.createElement('div');
                imageContainer.className = 'photo-slot-image';

                const img = document.createElement('img');
                img.src = photosArray[index].data;
                img.alt = `Zdjęcie ${index + 1}`;
                img.title = `Wykonane: ${photosArray[index].timestamp}`;

                img.onerror = () => {
                    console.error('Failed to load image:', index);
                    img.alt = '❌ Błąd ładowania';
                };

                imageContainer.appendChild(img);

                // Add click handler only for selectable (original) photos
                if (isSelectable) {
                    imageContainer.addEventListener('click', () => {
                        this.selectPhoto(index);
                    });
                }

                slot.appendChild(imageContainer);

                // Create download button
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'photo-download-btn';
                downloadBtn.textContent = '💾 Pobierz';
                downloadBtn.addEventListener('click', () => {
                    this.downloadPhotoByIndex(photosArray, index);
                });

                slot.appendChild(downloadBtn);

            } else {
                const imageContainer = document.createElement('div');
                imageContainer.className = 'photo-slot-image';
                imageContainer.textContent = emptyIcon;
                slot.classList.add('empty');
                slot.appendChild(imageContainer);
            }
        });

        // Update selection visual for original photos
        if (isSelectable && this.selectedPhotoIndex !== null) {
            if (this.selectedPhotoIndex < photosArray.length) {
                photoSlots[this.selectedPhotoIndex]?.classList.add('selected');
                this.photoBoothBtn.disabled = false;
            } else {
                this.selectedPhotoIndex = null;
                this.photoBoothBtn.disabled = true;
            }
        }
    }
    
    selectPhoto(index) {
        const photoSlots = this.originalPhotosGrid.querySelectorAll('.photo-slot');

        photoSlots.forEach(slot => slot.classList.remove('selected'));

        if (this.selectedPhotoIndex === index) {
            this.selectedPhotoIndex = null;
            this.photoBoothBtn.disabled = true;
        } else {
            this.selectedPhotoIndex = index;
            photoSlots[index].classList.add('selected');
            this.photoBoothBtn.disabled = false;
        }
    }

    downloadPhotoByIndex(photosArray, index) {
        const photo = photosArray[index];
        if (!photo || !photo.data) {
            this.showNotification('❌ Błąd pobierania zdjęcia', 'error');
            return;
        }

        const link = document.createElement('a');
        link.download = `ilovemarketing_${photo.id}.jpg`;
        link.href = photo.data;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('💾 Zdjęcie pobrane!', 'success');
    }
    
    initGenAI() {
        this.genAI = this.apiKey ? true : false;
        console.log('GenAI (curl mode) initialized:', !!this.genAI);
    }
    
    
    clearAllPhotos() {
        if (this.originalPhotos.length === 0 && this.photoboothPhotos.length === 0) {
            this.showNotification('Brak zdjęć do usunięcia', 'info');
            return;
        }

        if (confirm('Czy na pewno chcesz usunąć wszystkie zdjęcia?')) {
            this.originalPhotos = [];
            this.photoboothPhotos = [];
            this.selectedPhotoIndex = null;
            this.savePhotosToStorage();
            this.updatePhotosGrid();
            this.showNotification('Wszystkie zdjęcia zostały usunięte', 'info');
        }
    }
    
    
    
    
    loadNagrodaImage() {
        try {
            // Use the embedded real nagroda.png base64 data
            if (typeof NAGRODA_BASE64 !== 'undefined' && NAGRODA_BASE64) {
                this.nagrodaBase64 = NAGRODA_BASE64;
                console.log('🏆 Real embedded nagroda.png loaded successfully');
                return;
            }
            
            // Fallback: Create a programmatic trophy if embedded data is not available
            console.log('⚠️ Embedded nagroda.png not found, creating fallback trophy');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            
            // Draw a golden trophy shape
            ctx.fillStyle = '#FFD700'; // Gold color
            
            // Trophy cup
            ctx.beginPath();
            ctx.arc(100, 80, 40, 0, Math.PI * 2);
            ctx.fill();
            
            // Trophy base
            ctx.fillRect(80, 110, 40, 20);
            ctx.fillRect(70, 130, 60, 15);
            
            // Trophy handles
            ctx.beginPath();
            ctx.arc(65, 80, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(135, 80, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Add "I ❤️ Marketing" text
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('I ❤️ Marketing', 100, 100);
            ctx.fillText('& Technology', 100, 114);
            
            const dataURL = canvas.toDataURL('image/png');
            this.nagrodaBase64 = dataURL.split(',')[1]; // Remove data:image/png;base64, prefix
            console.log('🏆 Fallback trophy generated successfully');
            
        } catch (error) {
            console.error('Error loading nagroda image:', error);
            this.nagrodaBase64 = null;
        }
    }
    
    async createPhotoBooth() {
        if (this.selectedPhotoIndex === null) {
            this.showNotification('Wybierz zdjęcie do przerobienia na fotobudkę', 'error');
            return;
        }

        if (!this.nagrodaBase64) {
            this.showNotification('Błąd: Nie załadowano pliku nagroda.png', 'error');
            return;
        }
        
        // Check AI usage limit (only if limits are enabled)
        if (this.limitsEnabled && this.aiRequestsUsed >= this.maxAiRequests) {
            this.showNotification(`Limit AI osiągnięty (${this.maxAiRequests}/godzinę). Spróbuj ponownie za godzinę.`, 'error');
            return;
        }
        
        // Show loading overlay
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }

        this.photoBoothBtn.disabled = true;
        const originalText = this.photoBoothBtn.textContent;
        this.photoBoothBtn.textContent = '⏳ Czekaj...';

        try {
            const selectedPhoto = this.originalPhotos[this.selectedPhotoIndex];
            const userImageBase64 = selectedPhoto.data.replace(/^data:image\/[a-z]+;base64,/, '');

            const photoBoothPrompt = "Edit this photo so it looks like a photobooth picture taken at the I ❤️  Marketing & Technology conference. Add a professional backdrop with the I ❤️  Marketing & Technology white text, hearts are red, on black background repeated like on an event step-and-repeat wall. Realistic style, high-quality event photography. Studio-like lighting, polished look, authentic conference vibe. Provided person keeps the heart statue in hand. Add a small white caption on the bottom with black text \"📍Poznan, 30.10.2025\" next to the following hashtags as white text on red background: \"#ilovemtk\", \"#iloveai\", \"#marketerprogramista\".";

            const response = await this.callGeminiPhotoBoothAPI(userImageBase64, this.nagrodaBase64, photoBoothPrompt);

            if (response.type === 'image') {
                const newPhoto = {
                    id: Date.now(),
                    data: `data:image/jpeg;base64,${response.data}`,
                    timestamp: new Date().toLocaleString('pl-PL')
                };

                // Add to photobooth photos array (keep only 3)
                this.photoboothPhotos.unshift(newPhoto);
                if (this.photoboothPhotos.length > 3) {
                    this.photoboothPhotos = this.photoboothPhotos.slice(0, 3);
                }

                // Update AI usage counter
                if (this.limitsEnabled) {
                    this.aiRequestsUsed++;
                    this.saveHourlyLimits();
                }

                // Deselect photo
                this.selectedPhotoIndex = null;

                this.savePhotosToStorage();
                this.updatePhotosGrid();
                this.updateUsageLimits();

                this.showNotification('🏆 Fotobudka utworzona!', 'success');
            } else {
                this.showNotification('❌ Nie udało się wygenerować fotobudki', 'error');
            }
            
        } catch (error) {
            console.error('PhotoBooth error:', error);
            let errorMsg = 'Błąd fotobudki';
            if (error.message.includes('Failed to fetch')) {
                errorMsg = 'Brak połączenia z API. Sprawdź internet.';
            } else if (error.message) {
                errorMsg = `Błąd: ${error.message}`;
            }
            this.showNotification(`❌ ${errorMsg}`, 'error');
        } finally {
            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            this.photoBoothBtn.disabled = false;
            this.photoBoothBtn.textContent = '✨ Stwórz fotobudkę';
        }
    }
    
    async callGeminiPhotoBoothAPI(userImageBase64, nagrodaImageBase64, prompt) {
        const requestBody = {
            contents: [{
                parts: [
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: userImageBase64
                        }
                    },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: nagrodaImageBase64
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            }]
        };

        console.log('📸 Sending PhotoBooth request to proxy...');

        // Use API endpoint (works locally and on Vercel)
        const response = await fetch('/api/photobooth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Proxy API Error:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Proxy API Response received', data);

        // Debug: show full structure
        if (data.candidates && data.candidates[0]) {
            console.log('📊 Candidate structure:', JSON.stringify(data.candidates[0], null, 2));
        }

        if (data.error) {
            console.error('❌ API returned error:', data.error);
            throw new Error(data.error);
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const parts = data.candidates[0].content.parts;

            for (const part of parts) {
                if (part.inline_data && part.inline_data.data) {
                    console.log('🎉 PhotoBooth image generated!');
                    return {
                        type: 'image',
                        data: part.inline_data.data
                    };
                }

                if (part.inlineData && part.inlineData.data) {
                    console.log('🎉 PhotoBooth image generated!');
                    return {
                        type: 'image',
                        data: part.inlineData.data
                    };
                }
            }
        }

        return {
            type: 'text',
            data: 'No image generated'
        };
    }
    
    updateUsageLimits() {
        // Update capture button based on photo limit
        if (!this.limitsEnabled) {
            this.capturePhotoBtn.textContent = `📷 Zrób zdjęcie 🔓 (unlimited)`;
        } else if (this.photosUsed >= this.maxPhotos) {
            this.capturePhotoBtn.disabled = true;
            this.capturePhotoBtn.textContent = `📷 Limit (${this.photosUsed}/${this.maxPhotos})`;
        } else {
            this.capturePhotoBtn.textContent = `📷 Zrób zdjęcie (${this.photosUsed}/${this.maxPhotos})`;
        }
        
        // AI button removed in simplified interface
        
        // Add usage info to notification area if limits are reached (only when limits enabled)
        if (this.limitsEnabled && (this.photosUsed >= this.maxPhotos || this.aiRequestsUsed >= this.maxAiRequests)) {
            const limitInfo = document.createElement('div');
            limitInfo.className = 'usage-limits';
            limitInfo.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(255, 87, 87, 0.9);
                color: white;
                padding: 10px;
                border-radius: 8px;
                font-size: 12px;
                z-index: 1000;
                max-width: 200px;
            `;
            
            let message = '⚠️ Limity godzinowe:\n';
            if (this.photosUsed >= this.maxPhotos) {
                message += `📷 Zdjęcia: ${this.photosUsed}/${this.maxPhotos} (MAX)\n`;
            }
            if (this.aiRequestsUsed >= this.maxAiRequests) {
                message += `🤖 AI: ${this.aiRequestsUsed}/${this.maxAiRequests} (MAX)\n`;
            }
            message += '\n⏰ Limity resetują się co godzinę';
            
            limitInfo.textContent = message;
            
            // Remove existing limit info
            const existing = document.querySelector('.usage-limits');
            if (existing) existing.remove();
            
            // Add new limit info
            document.body.appendChild(limitInfo);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (limitInfo.parentNode) {
                    limitInfo.remove();
                }
            }, 5000);
        }
    }
    
    savePhotosToStorage() {
        try {
            const dataToSave = {
                original: this.originalPhotos.map(photo => ({
                    id: photo.id,
                    data: photo.data,
                    timestamp: photo.timestamp
                })),
                photobooth: this.photoboothPhotos.map(photo => ({
                    id: photo.id,
                    data: photo.data,
                    timestamp: photo.timestamp
                }))
            };
            localStorage.setItem('takepic_photos', JSON.stringify(dataToSave));
            this.checkStorageUsage();
        } catch (error) {
            console.error('Błąd podczas zapisywania zdjęć:', error);

            if (error.name === 'QuotaExceededError') {
                console.log('localStorage full, auto-cleanup...');
                this.photoboothPhotos = this.photoboothPhotos.slice(0, 2);
                this.originalPhotos = this.originalPhotos.slice(0, 2);

                try {
                    const dataToSave = {
                        original: this.originalPhotos.map(photo => ({
                            id: photo.id,
                            data: photo.data,
                            timestamp: photo.timestamp
                        })),
                        photobooth: this.photoboothPhotos.map(photo => ({
                            id: photo.id,
                            data: photo.data,
                            timestamp: photo.timestamp
                        }))
                    };
                    localStorage.setItem('takepic_photos', JSON.stringify(dataToSave));
                    this.showNotification('⚠️ Pamięć pełna - usunięto starsze zdjęcia', 'warning');
                    this.updatePhotosGrid();
                    this.checkStorageUsage();
                } catch (retryError) {
                    console.error('Failed to save even after cleanup:', retryError);
                    this.originalPhotos = [];
                    this.photoboothPhotos = [];
                    localStorage.removeItem('takepic_photos');
                    this.showNotification('❌ Pamięć przepełniona - wyczyszczono wszystkie zdjęcia', 'error');
                    this.updatePhotosGrid();
                }
            } else {
                this.showNotification('Błąd podczas zapisywania zdjęć', 'error');
            }
        }
    }
    
    loadPhotosFromStorage() {
        try {
            const stored = localStorage.getItem('takepic_photos');
            if (stored) {
                const data = JSON.parse(stored);

                // Handle old format (array) or new format (object)
                if (Array.isArray(data)) {
                    // Old format - migrate to new format
                    this.originalPhotos = data.filter(p => !p.aiPrompt);
                    this.photoboothPhotos = data.filter(p => p.aiPrompt);
                    console.log('📷 Migrated old format to new format');
                } else {
                    // New format
                    this.originalPhotos = data.original || [];
                    this.photoboothPhotos = data.photobooth || [];
                }

                // Validate photo data
                this.originalPhotos = this.originalPhotos.filter(photo => {
                    if (!photo.data || !photo.data.startsWith('data:image/')) {
                        console.warn('Removing invalid original photo:', photo.id);
                        return false;
                    }
                    return true;
                });

                this.photoboothPhotos = this.photoboothPhotos.filter(photo => {
                    if (!photo.data || !photo.data.startsWith('data:image/')) {
                        console.warn('Removing invalid photobooth photo:', photo.id);
                        return false;
                    }
                    return true;
                });

                console.log(`📷 Loaded ${this.originalPhotos.length} original, ${this.photoboothPhotos.length} photobooth photos`);
            } else {
                console.log('📷 No photos found in storage');
            }
        } catch (error) {
            console.error('Błąd podczas ładowania zdjęć:', error);
            console.log('📷 Clearing corrupted localStorage data...');
            localStorage.removeItem('takepic_photos');
            this.originalPhotos = [];
            this.photoboothPhotos = [];
        }
    }
    
    showNotification(message, type = 'info') {
        this.notification.textContent = message;
        this.notification.className = `notification ${type}`;
        this.notification.classList.add('show');
        
        setTimeout(() => {
            this.notification.classList.remove('show');
            this.notification.classList.add('hidden');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; color: white;">
                <div>
                    <h1>🚫 Nieobsługiwana przeglądarka</h1>
                    <p>Twoja przeglądarka nie obsługuje dostępu do kamery.</p>
                    <p>Spróbuj użyć nowszej wersji Chrome, Firefox lub Safari.</p>
                </div>
            </div>
        `;
        return;
    }
    
    new TakePicApp();
});

window.addEventListener('error', (event) => {
    console.error('Błąd aplikacji:', event.error);
});

