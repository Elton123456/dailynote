// FluencyFlow - Main Application Controller

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize API Client
    const aiClient = new DiaryAIClient();
    
    // State variables
    let todayImageBase64 = null;
    let recognition = null;
    let isRecording = false;
    let voices = [];
    
    // UI Selectors
    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    const speechStatus = document.getElementById('speech-status');
    const speechStatusText = document.getElementById('speech-status-text');
    const generateDiaryBtn = document.getElementById('generate-diary-btn');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const uploadZone = document.getElementById('upload-zone');
    const imageInput = document.getElementById('image-input');
    const currentDateEl = document.getElementById('current-date');
    
    // Diary Viewer Selectors
    const noDiaryPrompt = document.getElementById('no-diary-prompt');
    const diaryCardContent = document.getElementById('diary-card-content');
    const diaryTitle = document.getElementById('diary-title');
    const diaryDate = document.getElementById('diary-date');
    const diaryWordCount = document.getElementById('diary-word-count');
    const diaryPreviewImage = document.getElementById('diary-preview-image');
    const diaryContentEn = document.getElementById('diary-content-en');
    const diaryContentZh = document.getElementById('diary-content-zh');
    const diaryVocabList = document.getElementById('diary-vocab-list');
    const exportDiaryBtn = document.getElementById('export-diary-btn');
    const shareDiaryBtn = document.getElementById('share-diary-btn');
    const historyGrid = document.getElementById('history-grid');
    const historyCountBadge = document.getElementById('history-count');
    
    // Settings Selectors
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const modeMock = document.getElementById('mode-mock');
    const modeGemini = document.getElementById('mode-gemini');
    const geminiKeySection = document.getElementById('gemini-key-section');
    const geminiKeyInput = document.getElementById('gemini-key');
    const ttsRate = document.getElementById('tts-rate');
    const ttsRateVal = document.getElementById('tts-rate-val');
    const ttsVoiceSelect = document.getElementById('tts-voice-select');
    const btnClearData = document.getElementById('btn-clear-data');

    // --- 2. Initial Setup ---
    // Date
    const today = new Date();
    currentDateEl.innerText = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Load Settings
    loadSystemSettings();
    // Load History
    renderHistory();
    // Speech Synthesis voice loading
    initTTS();

    // --- 3. Speech synthesis & Recognition (TTS / STT) ---
    function initTTS() {
        if (!('speechSynthesis' in window)) return;
        
        const loadVoices = () => {
            voices = window.speechSynthesis.getVoices();
            ttsVoiceSelect.innerHTML = '';
            
            // Filter for English voices
            const enVoices = voices.filter(v => v.lang.startsWith('en'));
            
            enVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                
                // Set default to Google US English or standard English if available
                if (voice.name.includes('Google US English') || voice.name.includes('Samantha') || voice.name.includes('Zira')) {
                    option.selected = true;
                }
                ttsVoiceSelect.appendChild(option);
            });
            
            if (ttsVoiceSelect.children.length === 0) {
                const opt = document.createElement('option');
                opt.value = 'default';
                opt.textContent = '默认系统女声';
                ttsVoiceSelect.appendChild(opt);
            }
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    function speakText(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Stop active speaking

        const rate = parseFloat(ttsRate.value) || 0.9;
        const selectedVoiceName = ttsVoiceSelect.value;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        
        if (selectedVoiceName !== 'default') {
            const voice = voices.find(v => v.name === selectedVoiceName);
            if (voice) utterance.voice = voice;
        }
        
        window.speechSynthesis.speak(utterance);
    }

    // Initialize Web Speech Recognition
    function initSTT() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.log("Speech recognition not supported in this browser.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'zh-CN'; // Default transcribing from Chinese for beginners

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            speechStatus.style.display = 'flex';
            speechStatusText.innerText = "正在倾听您的声音 (请说中文或英文)...";
        };

        recognition.onerror = (e) => {
            console.error("Speech recognition error:", e);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = chatInput.value ? chatInput.value + ' ' + transcript : transcript;
            chatInput.focus();
        };
    }

    function stopRecording() {
        isRecording = false;
        micBtn.classList.remove('recording');
        speechStatus.style.display = 'none';
        if (recognition) recognition.stop();
    }

    initSTT();

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (!recognition) {
                alert("您的浏览器暂不支持原生语音识别功能。建议使用 Google Chrome, Safari 或 Microsoft Edge 浏览器来使用语音输入练习口语。现在，您可以直接在输入框内键入中文或英文参与对话。");
                return;
            }
            if (isRecording) {
                stopRecording();
            } else {
                recognition.start();
            }
        });
    }

    // --- 4. File Upload & Canvas Morph trigger ---
    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploadZone.style.background = 'rgba(159, 92, 240, 0.2)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            uploadZone.style.background = 'rgba(10, 9, 20, 0.7)';
        }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleImageFile(files[0]);
    });

    imageInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length) handleImageFile(files[0]);
    });

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('请上传图片格式的文件！');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Url = reader.result;
            todayImageBase64 = base64Url;
            
            // Hide upload overlay and show Three.js canvas morph animation
            uploadZone.classList.add('hidden');
            
            // Append system message: Morphing started
            appendSystemMessage("正在重构像素，转化为 3D 粒子系统...");
            
            try {
                if (window.visualizerEngine) {
                    await window.visualizerEngine.loadImageAndConvert(base64Url);
                }
                
                // Reset AI dialog history and start conversation loop
                aiClient.resetHistory();
                appendSystemMessage("3D 映像载入成功！AI 对话已开启。");
                
                // Let AI welcome user about the image
                const response = await aiClient.sendMessage("", base64Url);
                appendMessage("assistant", response.text, response.translation);
                speakText(response.text);
                
            } catch (err) {
                console.error("Error loading image particles:", err);
                appendSystemMessage("图像粒子化失败，已启动备用轻量级对话。");
                
                aiClient.resetHistory();
                const response = await aiClient.sendMessage("", null);
                appendMessage("assistant", response.text, response.translation);
                speakText(response.text);
            }
        };
    }

    // --- 5. Message List Operations ---
    function appendMessage(role, text, translation = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        const avatarHtml = role === 'assistant' 
            ? `<div class="message-avatar"><i class="fa-solid fa-robot"></i></div>`
            : `<div class="message-avatar"><i class="fa-solid fa-user"></i></div>`;
            
        let controlsHtml = '';
        if (role === 'assistant') {
            controlsHtml = `
                <div class="message-controls">
                    <button class="bubble-action-btn btn-speak" title="朗读语音">
                        <i class="fa-solid fa-volume-high"></i> Listen
                    </button>
                    <button class="bubble-action-btn btn-translate" title="显示中文翻译">
                        <i class="fa-solid fa-language"></i> Translate
                    </button>
                </div>
                <div class="translation-box hidden">${translation || "翻译暂不可用..."}</div>
            `;
        }

        msgDiv.innerHTML = `
            ${avatarHtml}
            <div class="message-bubble">
                <p>${text}</p>
                ${controlsHtml}
            </div>
        `;
        
        chatLog.appendChild(msgDiv);
        chatLog.scrollTop = chatLog.scrollHeight;

        // Attach event listeners for audio and translation
        if (role === 'assistant') {
            const speakBtn = msgDiv.querySelector('.btn-speak');
            const translateBtn = msgDiv.querySelector('.btn-translate');
            const transBox = msgDiv.querySelector('.translation-box');

            if (speakBtn) {
                speakBtn.addEventListener('click', () => speakText(text));
            }
            if (translateBtn) {
                translateBtn.addEventListener('click', () => {
                    transBox.classList.toggle('hidden');
                });
            }
        }
    }

    function appendSystemMessage(text) {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'message system';
        sysDiv.style.alignSelf = 'center';
        sysDiv.style.maxWidth = '90%';
        sysDiv.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.02); color: var(--text-secondary); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 6px 12px; font-size: 12px; text-align: center;">
                <i class="fa-solid fa-circle-info"></i> ${text}
            </div>
        `;
        chatLog.appendChild(sysDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // --- 6. Send Button & Input Trigger ---
    async function handleUserSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user bubble
        appendMessage("user", text);
        chatInput.value = "";
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message assistant typing';
        typingIndicator.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-bubble" style="opacity: 0.6;">
                <i class="fa-solid fa-ellipsis fa-fade"></i> AI is thinking...
            </div>
        `;
        chatLog.appendChild(typingIndicator);
        chatLog.scrollTop = chatLog.scrollHeight;

        try {
            // Call AI Client
            const reply = await aiClient.sendMessage(text);
            
            // Remove typing bubble
            typingIndicator.remove();
            
            // Add assistant bubble
            appendMessage("assistant", reply.text, reply.translation);
            
            // Auto synthesis response
            speakText(reply.text);
            
        } catch (err) {
            console.error(err);
            typingIndicator.remove();
            appendMessage("assistant", "Sorry, I ran into an error generating my response. Let's try again!", "抱歉，我在生成回复时遇到了错误。请再试一次！");
        }
    }

    sendBtn.addEventListener('click', handleUserSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUserSend();
    });

    // --- 7. Tab Swaps ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // --- 8. Generate Daily Diary ---
    generateDiaryBtn.addEventListener('click', async () => {
        // Change to Diary Tab and show loading
        const diaryTabBtn = document.querySelector('[data-tab="diary"]');
        diaryTabBtn.click();
        
        noDiaryPrompt.classList.add('hidden');
        diaryCardContent.classList.add('hidden');
        
        const loader = document.createElement('div');
        loader.className = 'tech-loader-container';
        loader.innerHTML = `
            <i class="fa-solid fa-microchip tech-loader-icon"></i>
            <h3 class="tech-glow-text">NEURAL MEMORY RECONSTRUCTION</h3>
            <div class="tech-progress-bar">
                <div class="tech-progress-fill" id="tech-progress-bar-fill"></div>
            </div>
            <div class="tech-log-readout" id="tech-loader-log">
                <div class="log-line">> CONNECTING TO NEURAL NETWORK...</div>
            </div>
        `;
        document.getElementById('current-diary-view').appendChild(loader);

        const logLines = [
            "INITIALIZING NEURAL MEMORY SCANNER...",
            "PARSING 3D PIXEL SPECTRAL MATRIX...",
            "EXTRACTING LANGUAGE TOKENS AND SYNTAX...",
            "GEMINI AI LINGUISTIC ALIGNMENT ESTABLISHED...",
            "DECODING DIARY CONTENT AND TRANSLATIONS...",
            "COMPILATION COMPLETE. ARCHIVING TELEMETRY..."
        ];

        // Futuristic progress animation
        const runTechLoading = () => {
            return new Promise((resolve) => {
                let progress = 0;
                let step = 0;
                const logEl = loader.querySelector('#tech-loader-log');
                const fillEl = loader.querySelector('#tech-progress-bar-fill');
                
                const interval = setInterval(() => {
                    progress += Math.floor(Math.random() * 8) + 4;
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(interval);
                        resolve();
                    }
                    
                    if (fillEl) fillEl.style.width = `${progress}%`;
                    
                    // Stagger log lines based on progress
                    const targetStep = Math.floor((progress / 100) * logLines.length);
                    if (targetStep > step && step < logLines.length) {
                        step = targetStep;
                        if (logEl && logLines[step]) {
                            const line = document.createElement('div');
                            line.className = 'log-line';
                            line.innerText = `> ${logLines[step]}`;
                            logEl.appendChild(line);
                            logEl.scrollTop = logEl.scrollHeight;
                        }
                    }
                }, 120);
            });
        };

        // Trigger API call
        const apiCallPromise = (async () => {
            if (aiClient.apiMode === 'gemini' && aiClient.apiKey) {
                return await aiClient.generateDiaryGemini();
            } else {
                return await aiClient.generateMockDiary();
            }
        })();

        try {
            // Wait for both the API response and the sci-fi progress bar to finish
            const [diaryData] = await Promise.all([apiCallPromise, runTechLoading()]);

            loader.remove();
            displayDiaryCard(diaryData, todayImageBase64);
            
            // Save to LocalStorage history
            saveDiaryToHistory(diaryData, todayImageBase64);
            renderHistory();

        } catch (err) {
            console.error("Diary generation failed:", err);
            loader.remove();
            noDiaryPrompt.classList.remove('hidden');
            alert("日记编译失败，请确保网络通畅或检查您的 API Key。");
        }
    });

    function displayDiaryCard(diaryData, imageBase64) {
        diaryCardContent.classList.remove('hidden');
        noDiaryPrompt.classList.add('hidden');
        
        diaryTitle.innerText = diaryData.title || "A Day of Memories";
        diaryDate.innerHTML = `<i class="fa-regular fa-calendar-days"></i> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        
        // Word count
        const wordCount = (diaryData.diaryEn || '').split(/\s+/).filter(Boolean).length;
        diaryWordCount.innerText = `${wordCount} words`;

        // Image
        if (imageBase64) {
            diaryPreviewImage.src = imageBase64;
            document.getElementById('diary-img-box').classList.remove('hidden');
        } else {
            document.getElementById('diary-img-box').classList.add('hidden');
        }

        // English and Chinese text
        diaryContentEn.innerText = diaryData.diaryEn;
        diaryContentZh.innerText = diaryData.diaryZh;

        // Vocabulary List
        diaryVocabList.innerHTML = '';
        if (diaryData.vocab && diaryData.vocab.length) {
            diaryData.vocab.forEach(item => {
                const tag = document.createElement('div');
                tag.className = 'vocab-tag';
                tag.innerHTML = `
                    <span class="vocab-word">${item.word}</span>
                    <span class="vocab-mean">${item.translation}</span>
                `;
                diaryVocabList.appendChild(tag);
            });
        }
    }

    // --- 9. LocalStorage History Management ---
    function saveDiaryToHistory(diaryData, imageBase64) {
        const history = JSON.parse(localStorage.getItem('fluency_diary_history') || '[]');
        
        const timestamp = new Date().getTime();
        const dateString = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric' });
        
        const newEntry = {
            id: timestamp,
            dateStr: dateString,
            title: diaryData.title,
            diaryEn: diaryData.diaryEn,
            diaryZh: diaryData.diaryZh,
            vocab: diaryData.vocab,
            imageBase64: imageBase64
        };

        // Prevent duplicate entries for same day (simply push new ones)
        history.unshift(newEntry);
        localStorage.setItem('fluency_diary_history', JSON.stringify(history));
    }

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem('fluency_diary_history') || '[]');
        historyCountBadge.innerText = `${history.length} 篇`;
        
        historyGrid.innerHTML = '';
        if (history.length === 0) {
            historyGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px 0;">
                    暂无历史手账
                </div>
            `;
            return;
        }

        history.forEach(item => {
            const hDiv = document.createElement('div');
            hDiv.className = 'history-item';
            
            const imgHtml = item.imageBase64
                ? `<img class="history-item-img" src="${item.imageBase64}">`
                : `<div class="history-item-img" style="background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--text-muted);"><i class="fa-solid fa-signature"></i></div>`;

            hDiv.innerHTML = `
                ${imgHtml}
                <div class="history-item-date">${item.dateStr}</div>
                <div class="history-item-title">${item.title}</div>
            `;

            hDiv.addEventListener('click', () => {
                // Load details of this history into viewer card
                noDiaryPrompt.classList.add('hidden');
                diaryCardContent.classList.remove('hidden');
                
                diaryTitle.innerText = item.title;
                diaryDate.innerHTML = `<i class="fa-regular fa-calendar-days"></i> ${item.dateStr}`;
                
                const wordCount = (item.diaryEn || '').split(/\s+/).filter(Boolean).length;
                diaryWordCount.innerText = `${wordCount} words`;
                
                if (item.imageBase64) {
                    diaryPreviewImage.src = item.imageBase64;
                    document.getElementById('diary-img-box').classList.remove('hidden');
                } else {
                    document.getElementById('diary-img-box').classList.add('hidden');
                }

                diaryContentEn.innerText = item.diaryEn;
                diaryContentZh.innerText = item.diaryZh;

                diaryVocabList.innerHTML = '';
                if (item.vocab && item.vocab.length) {
                    item.vocab.forEach(v => {
                        const tag = document.createElement('div');
                        tag.className = 'vocab-tag';
                        tag.innerHTML = `
                            <span class="vocab-word">${v.word}</span>
                            <span class="vocab-mean">${v.translation}</span>
                        `;
                        diaryVocabList.appendChild(tag);
                    });
                }
            });

            historyGrid.appendChild(hDiv);
        });
    }

    // Copying and Export options
    shareDiaryBtn.addEventListener('click', () => {
        const textToCopy = `Title: ${diaryTitle.innerText}\n\nEnglish:\n${diaryContentEn.innerText}\n\n中文译文:\n${diaryContentZh.innerText}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('日记已成功复制到剪贴板！');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });

    exportDiaryBtn.addEventListener('click', () => {
        // Trigger print-friendly preview or simple save file
        const element = document.createElement('a');
        const fileContent = `FluencyFlow 口语手账\n日期: ${diaryDate.innerText}\n标题: ${diaryTitle.innerText}\n\n[English Diary]\n${diaryContentEn.innerText}\n\n[中文译文]\n${diaryContentZh.innerText}`;
        const file = new Blob([fileContent], {type: 'text/plain;charset=utf-8'});
        element.href = URL.createObjectURL(file);
        element.download = `${diaryTitle.innerText.replace(/\s+/g, '_')}_Diary.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    });

    // --- 10. Settings Panel Actions ---
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    // Close when clicking overlay
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    // Speed slider display updates
    ttsRate.addEventListener('input', () => {
        ttsRateVal.innerText = ttsRate.value;
    });

    // Mode Toggle Logic
    modeMock.addEventListener('click', () => {
        modeMock.classList.add('active');
        modeGemini.classList.remove('active');
        geminiKeySection.classList.add('hidden');
    });

    modeGemini.addEventListener('click', () => {
        modeGemini.classList.add('active');
        modeMock.classList.remove('active');
        geminiKeySection.classList.remove('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const activeMode = modeGemini.classList.contains('active') ? 'gemini' : 'mock';
        aiClient.setMode(activeMode);
        
        if (activeMode === 'gemini') {
            const key = geminiKeyInput.value.trim();
            if (!key && !aiClient.apiKey) {
                alert("请输入合法的 Gemini API Key，或切回模拟模式。");
                return;
            }
            aiClient.setApiKey(key);
        }

        // Save speech synthesis rate and voice settings
        localStorage.setItem('fluency_tts_rate', ttsRate.value);
        localStorage.setItem('fluency_tts_voice', ttsVoiceSelect.value);

        settingsModal.classList.remove('active');
        appendSystemMessage("系统设置已更新。");
    });

    btnClearData.addEventListener('click', () => {
        if (confirm("确定要永久清除本地的所有历史日记和配置吗？此操作无法撤销。")) {
            localStorage.clear();
            aiClient.resetHistory();
            renderHistory();
            noDiaryPrompt.classList.remove('hidden');
            diaryCardContent.classList.add('hidden');
            uploadZone.classList.remove('hidden');
            if (window.visualizerEngine) {
                window.visualizerEngine.generateDefaultSphere();
            }
            alert("数据已清空。");
            settingsModal.classList.remove('active');
        }
    });

    function loadSystemSettings() {
        // Mode
        const mode = localStorage.getItem('fluency_api_mode') || 'mock';
        if (mode === 'gemini') {
            modeGemini.click();
        } else {
            modeMock.click();
        }

        // Key
        const key = localStorage.getItem('fluency_gemini_key') || '';
        geminiKeyInput.value = key;
        aiClient.setApiKey(key);

        // TTS settings
        const rate = localStorage.getItem('fluency_tts_rate') || '0.9';
        ttsRate.value = rate;
        ttsRateVal.innerText = rate;

        const voice = localStorage.getItem('fluency_tts_voice');
        if (voice) {
            // Wait for voices to load
            setTimeout(() => {
                ttsVoiceSelect.value = voice;
            }, 300);
        }
    }
});
