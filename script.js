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
        this.photosGrid = document.getElementById('photosGrid');
        this.notification = document.getElementById('notification');
        
        this.startCameraBtn = document.getElementById('startCamera');
        this.capturePhotoBtn = document.getElementById('capturePhoto');
        this.stopCameraBtn = document.getElementById('stopCamera');
        this.clearPhotosBtn = document.getElementById('clearPhotos');
        this.downloadPhotoBtn = document.getElementById('downloadPhoto');
        this.photoBoothBtn = document.getElementById('photoBooth');
        
        this.filterBtns = document.querySelectorAll('.filter-btn');
        // AI elements removed from simplified interface
        this.aiPromptInput = null;
        this.apiKeyInput = null;
        this.applyAIBtn = null;
        this.aiStatus = null;
        
        this.stream = null;
        this.photos = [];
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
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        this.stopCameraBtn.addEventListener('click', () => this.stopCamera());
        this.clearPhotosBtn.addEventListener('click', () => this.clearAllPhotos());
        this.downloadPhotoBtn.addEventListener('click', () => this.downloadSelectedPhoto());
        this.photoBoothBtn.addEventListener('click', () => this.createPhotoBooth());
        
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter));
        });
        
        // Initialize AI for PhotoBooth only
        this.initGenAI();
        
        window.addEventListener('beforeunload', () => {
            this.stopCamera();
        });
    }
    
    async startCamera() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            };
            
            this.startCameraBtn.disabled = true;
            this.capturePhotoBtn.disabled = false;
            this.stopCameraBtn.disabled = false;
            
            document.querySelector('.camera-container').classList.add('recording');
            this.showNotification('Kamera włączona pomyślnie!', 'success');
            
        } catch (error) {
            console.error('Błąd podczas uruchamiania kamery:', error);
            this.showNotification('Nie udało się włączyć kamery. Sprawdź uprawnienia.', 'error');
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
        const dataURL = this.canvas.toDataURL('image/jpeg', 0.6); // Lower quality to save space
        
        const photo = {
            id: Date.now(),
            data: dataURL,
            timestamp: new Date().toLocaleString('pl-PL')
        };
        
        this.photos.unshift(photo);
        
        // Keep only 5 photos to prevent localStorage overflow
        if (this.photos.length > 5) {
            this.photos = this.photos.slice(0, 5);
        }
        
        // Update selection index since we added photo at beginning
        if (this.selectedPhotoIndex !== null) {
            this.selectedPhotoIndex++;
            // If selection is now out of bounds, reset it
            if (this.selectedPhotoIndex >= this.photos.length) {
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
        const photoSlots = this.photosGrid.querySelectorAll('.photo-slot');
        console.log(`🔄 Updating photos grid: ${this.photos.length} photos, ${photoSlots.length} slots`);
        console.log(`🎪 PhotoBooth button state before update: disabled=${this.photoBoothBtn.disabled}, selectedIndex=${this.selectedPhotoIndex}`);
        
        photoSlots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.className = 'photo-slot';
            
            if (this.photos[index]) {
                const img = document.createElement('img');
                img.src = this.photos[index].data;
                img.alt = `Zdjęcie ${index + 1}`;
                
                // Better tooltip for AI photos
                let title = `Wykonane: ${this.photos[index].timestamp}`;
                if (this.photos[index].aiPrompt) {
                    title += `\n🤖 AI: ${this.photos[index].aiPrompt}`;
                }
                img.title = title;
                
                // Add error handling for broken images
                img.onerror = () => {
                    console.error('Failed to load image:', {
                        index,
                        hasData: !!this.photos[index].data,
                        dataLength: this.photos[index].data?.length,
                        dataPrefix: this.photos[index].data?.substring(0, 50),
                        isAI: !!this.photos[index].aiPrompt
                    });
                    img.alt = '❌ Błąd ładowania';
                };
                
                slot.appendChild(img);
                
                slot.addEventListener('click', (event) => {
                    console.log(`🖱️ Clicked on photo slot ${index}`);
                    event.preventDefault();
                    this.selectPhoto(index);
                });
            } else {
                slot.classList.add('empty');
                slot.textContent = '📷';
            }
        });
        
        // Only reset selection if the selected photo no longer exists
        if (this.selectedPhotoIndex !== null && this.selectedPhotoIndex >= this.photos.length) {
            this.selectedPhotoIndex = null;
            this.downloadPhotoBtn.disabled = true;
            this.photoBoothBtn.disabled = true;
        }
        
        // Restore selection visual if photo is still selected
        if (this.selectedPhotoIndex !== null && this.selectedPhotoIndex < this.photos.length) {
            photoSlots[this.selectedPhotoIndex]?.classList.add('selected');
            // Re-enable buttons when photo is selected
            this.downloadPhotoBtn.disabled = false;
            this.photoBoothBtn.disabled = false;
            console.log(`🎪 PhotoBooth button re-enabled for selected photo ${this.selectedPhotoIndex}`);
        }
    }
    
    selectPhoto(index) {
        console.log(`📸 Selecting photo ${index}, total photos: ${this.photos.length}`);
        const photoSlots = this.photosGrid.querySelectorAll('.photo-slot');
        
        photoSlots.forEach(slot => slot.classList.remove('selected'));
        
        if (this.selectedPhotoIndex === index) {
            console.log('🔄 Deselecting photo');
            this.selectedPhotoIndex = null;
            this.downloadPhotoBtn.disabled = true;
            this.photoBoothBtn.disabled = true;
        } else {
            console.log(`✅ Photo ${index} selected`);
            this.selectedPhotoIndex = index;
            photoSlots[index].classList.add('selected');
            this.downloadPhotoBtn.disabled = false;
            // Enable photobooth - API key will be requested when needed
            this.photoBoothBtn.disabled = false;
            console.log('🎪 PhotoBooth button enabled');
        }
        
    }
    
    initGenAI() {
        this.genAI = this.apiKey ? true : false;
        console.log('GenAI (curl mode) initialized:', !!this.genAI);
    }
    
    downloadSelectedPhoto() {
        if (this.selectedPhotoIndex === null) {
            this.showNotification('Wybierz zdjęcie do pobrania', 'error');
            return;
        }
        
        const photo = this.photos[this.selectedPhotoIndex];
        
        // Enhanced validation
        if (!photo) {
            this.showNotification('❌ Nie znaleziono wybranego zdjęcia', 'error');
            return;
        }
        
        if (!photo.data || typeof photo.data !== 'string') {
            this.showNotification('❌ Zdjęcie ma nieprawidłowy format danych', 'error');
            console.error('Invalid photo data:', {
                hasData: !!photo.data,
                dataType: typeof photo.data,
                dataPrefix: photo.data?.substring(0, 50),
                isAI: !!photo.aiPrompt
            });
            return;
        }
        
        if (!photo.data.startsWith('data:image/')) {
            this.showNotification('❌ Zdjęcie nie jest w prawidłowym formacie obrazu', 'error');
            console.error('Not a valid image data URL:', {
                dataPrefix: photo.data.substring(0, 50),
                isAI: !!photo.aiPrompt
            });
            return;
        }
        
        const link = document.createElement('a');
        
        // Better filename for AI photos
        let filename = `takepic_${photo.id}`;
        if (photo.aiPrompt) {
            filename += `_AI`;
        }
        filename += '.jpg';
        
        link.download = filename;
        link.href = photo.data;
        
        // Debugging - log photo data for AI photos
        if (photo.aiPrompt) {
            console.log('💾 Downloading AI photo:', {
                id: photo.id,
                hasData: !!photo.data,
                dataLength: photo.data ? photo.data.length : 0,
                dataPrefix: photo.data ? photo.data.substring(0, 30) : 'no data',
                isValidDataURL: photo.data ? photo.data.startsWith('data:image/') : false
            });
        } else {
            console.log('💾 Downloading regular photo:', {
                id: photo.id,
                hasData: !!photo.data,
                dataLength: photo.data ? photo.data.length : 0
            });
        }
        document.body.appendChild(link);
        
        // Try download and catch any errors
        try {
            link.click();
            // Wait a bit to ensure download started
            setTimeout(() => {
                try {
                    if (document.body.contains(link)) {
                        document.body.removeChild(link);
                    }
                } catch (e) {
                    console.warn('Failed to remove download link:', e);
                }
            }, 100);
            
            this.showNotification(photo.aiPrompt ? 'Zdjęcie AI zostało pobrane!' : 'Zdjęcie zostało pobrane!', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.showNotification('❌ Błąd podczas pobierania zdjęcia', 'error');
            
            // Clean up on error
            try {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
            } catch (e) {
                console.warn('Failed to remove download link after error:', e);
            }
        }
    }
    
    clearAllPhotos() {
        if (this.photos.length === 0) {
            this.showNotification('Brak zdjęć do usunięcia', 'info');
            return;
        }
        
        if (confirm('Czy na pewno chcesz usunąć wszystkie zdjęcia?')) {
            this.photos = [];
            this.selectedPhotoIndex = null;
            this.savePhotosToStorage();
            this.updatePhotosGrid();
            this.showNotification('Wszystkie zdjęcia zostały usunięte', 'info');
        }
    }
    
    applyFilter(filterName) {
        this.currentFilter = filterName;
        
        this.filterBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filterName}"]`).classList.add('active');
        
        let filterCSS = '';
        
        switch (filterName) {
            case 'none':
                filterCSS = 'none';
                break;
            case 'sepia':
                filterCSS = 'sepia(100%)';
                break;
            case 'grayscale':
                filterCSS = 'grayscale(100%)';
                break;
            case 'blur':
                filterCSS = 'blur(2px)';
                break;
            case 'brightness':
                filterCSS = 'brightness(130%)';
                break;
            case 'contrast':
                filterCSS = 'contrast(130%)';
                break;
            case 'saturate':
                filterCSS = 'saturate(200%)';
                break;
            case 'vintage':
                filterCSS = 'sepia(50%) contrast(120%) brightness(110%) saturate(130%)';
                break;
            default:
                filterCSS = 'none';
        }
        
        this.video.style.filter = filterCSS;
        this.showNotification(`Filtr ${filterName} zastosowany!`, 'success');
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
        
        // Prompt for API key if not available
        if (!this.apiKey) {
            const savedKey = localStorage.getItem('gemini_api_key');
            if (savedKey) {
                this.apiKey = savedKey;
                this.initGenAI();
                console.log('🔑 Using saved API key');
            } else {
                const apiKey = prompt('Wprowadź klucz API Google Gemini dla funkcji fotobudki:');
                if (!apiKey || apiKey.trim() === '') {
                    this.showNotification('Klucz API jest wymagany dla fotobudki', 'error');
                    return;
                }
                this.apiKey = apiKey.trim();
                localStorage.setItem('gemini_api_key', this.apiKey);
                this.initGenAI();
                console.log('🔑 API key saved for future use');
            }
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
        
        this.photoBoothBtn.disabled = true;
        this.photoBoothBtn.textContent = '📸 Tworzenie...';
        
        try {
            const selectedPhoto = this.photos[this.selectedPhotoIndex];
            const userImageBase64 = selectedPhoto.data.replace(/^data:image\/[a-z]+;base64,/, '');
            
            const photoBoothPrompt = "Edit this photo so it looks like a photobooth picture taken at the I ❤️ Marketing & Technology conference. Add a professional backdrop with the I ❤️ Marketing & Technology white logo on black background repeated like on an event step-and-repeat wall. Realistic style, high-quality event photography. Studio-like lighting, polished look, authentic conference vibe. Provided person keeps the heart statue in hand. Add a small white caption on the bottom with black text \"Poznan, 30.10.2025\"";
            
            const response = await this.callGeminiPhotoBoothAPI(userImageBase64, this.nagrodaBase64, photoBoothPrompt);
            
            if (response.type === 'image') {
                // Compress the PhotoBooth image more aggressively to avoid localStorage overflow
                const compressedImage = await this.compressImageBase64(`data:image/jpeg;base64,${response.data}`, 0.3);
                
                const newPhoto = {
                    id: Date.now(),
                    data: compressedImage,
                    timestamp: new Date().toLocaleString('pl-PL'),
                    aiPrompt: 'Fotobudka I ❤️ Marketing & Technology',
                    aiDescription: 'Fotobudka konferencyjna z nagrodą'
                };
                
                // For PhotoBooth images, keep only 2 photos to prevent localStorage overflow
                this.photos.unshift(newPhoto);
                if (this.photos.length > 2) {
                    this.photos = this.photos.slice(0, 2);
                    console.log('📸 PhotoBooth: Keeping only 2 photos to save space');
                }
                
                // Update selection index since we added photo at beginning
                if (this.selectedPhotoIndex !== null) {
                    this.selectedPhotoIndex++;
                    // If selection is now out of bounds, reset it
                    if (this.selectedPhotoIndex >= this.photos.length) {
                        this.selectedPhotoIndex = null;
                    }
                }
                
                // Update AI usage counter (only if limits are enabled)
                if (this.limitsEnabled) {
                    this.aiRequestsUsed++;
                    this.saveHourlyLimits();
                }
                
                // Clear localStorage completely before saving PhotoBooth result
                localStorage.removeItem('takepic_photos');
                this.savePhotosToStorage();
                this.updatePhotosGrid();
                this.updateUsageLimits();
                
                this.showNotification('🏆 Fotobudka utworzona! Stare zdjęcia usunięte aby zaoszczędzić miejsce.', 'success');
            } else {
                this.showNotification('❌ Nie udało się wygenerować fotobudki', 'error');
            }
            
        } catch (error) {
            console.error('PhotoBooth error:', error);
            this.showNotification(`❌ Błąd fotobudki: ${error.message}`, 'error');
        } finally {
            this.photoBoothBtn.disabled = false;
            this.photoBoothBtn.textContent = '📸 Fotobudka';
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
        
        console.log('📸 Sending PhotoBooth API request...');
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent`, {
            method: 'POST',
            headers: {
                'x-goog-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('PhotoBooth API Error:', errorData);
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('PhotoBooth API Response:', data);
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const parts = data.candidates[0].content.parts;
            
            for (const part of parts) {
                if (part.inline_data && part.inline_data.data) {
                    console.log('🎉 PhotoBooth image generated successfully!');
                    return {
                        type: 'image',
                        data: part.inline_data.data
                    };
                }
                
                if (part.inlineData && part.inlineData.data) {
                    console.log('🎉 PhotoBooth image generated successfully (inlineData)!');
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
    
    async compressImageBase64(dataURL, quality = 0.5, maxWidth = 800) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
                
                console.log(`🗜️ Image compressed: ${Math.round(dataURL.length/1024)}KB → ${Math.round(compressedDataURL.length/1024)}KB`);
                resolve(compressedDataURL);
            };
            img.src = dataURL;
        });
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
            const photosToSave = this.photos.map(photo => ({
                id: photo.id,
                data: photo.data,
                timestamp: photo.timestamp,
                aiPrompt: photo.aiPrompt,
                aiDescription: photo.aiDescription
            }));
            localStorage.setItem('takepic_photos', JSON.stringify(photosToSave));
            this.checkStorageUsage();
        } catch (error) {
            console.error('Błąd podczas zapisywania zdjęć:', error);
            
            if (error.name === 'QuotaExceededError') {
                // Auto-cleanup: keep only 2 most recent photos
                console.log('localStorage full, auto-cleanup...');
                this.photos = this.photos.slice(0, 2);
                
                try {
                    const photosToSave = this.photos.map(photo => ({
                        id: photo.id,
                        data: photo.data,
                        timestamp: photo.timestamp,
                        aiPrompt: photo.aiPrompt,
                        aiDescription: photo.aiDescription
                    }));
                    localStorage.setItem('takepic_photos', JSON.stringify(photosToSave));
                    this.showNotification('⚠️ Pamięć pełna - usunięto starsze zdjęcia', 'warning');
                    this.updatePhotosGrid();
                    this.checkStorageUsage();
                } catch (retryError) {
                    // If still fails, clear all photos
                    console.error('Failed to save even after cleanup:', retryError);
                    this.photos = [];
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
                this.photos = JSON.parse(stored);
                console.log(`📷 Loaded ${this.photos.length} photos from storage`);
                
                // Validate photo data
                this.photos = this.photos.filter(photo => {
                    if (!photo.data || !photo.data.startsWith('data:image/')) {
                        console.warn('Removing invalid photo:', photo.id);
                        return false;
                    }
                    return true;
                });
                
                console.log(`📷 After validation: ${this.photos.length} valid photos`);
            } else {
                console.log('📷 No photos found in storage');
            }
        } catch (error) {
            console.error('Błąd podczas ładowania zdjęć:', error);
            console.log('📷 Clearing corrupted localStorage data...');
            localStorage.removeItem('takepic_photos');
            this.photos = [];
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}