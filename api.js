// FluencyFlow - AI Conversation and Diary API Layer

class DiaryAIClient {
    constructor() {
        this.apiKey = localStorage.getItem('fluency_gemini_key') || '';
        this.apiMode = localStorage.getItem('fluency_api_mode') || 'mock'; // 'mock' or 'gemini'
        
        // Chat History for Gemini API API
        // Format: { role: "user"|"model", parts: [ { text: "..." }, { inlineData: ... } ] }
        this.chatHistory = [];
        
        // Mock Simulator State Machine
        this.mockState = {
            currentTurn: 0,
            detectedTopic: 'general', // 'food', 'nature', 'pet', 'work', 'general'
            imageUploaded: false,
            userResponses: []
        };
    }

    setMode(mode) {
        this.apiMode = mode;
        localStorage.setItem('fluency_api_mode', mode);
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('fluency_gemini_key', key);
    }

    resetHistory() {
        this.chatHistory = [];
        this.mockState = {
            currentTurn: 0,
            detectedTopic: 'general',
            imageUploaded: false,
            userResponses: []
        };
    }

    // Main entry point for sending message
    async sendMessage(userInput, imageBase64 = null) {
        if (this.apiMode === 'gemini' && this.apiKey) {
            return await this.callGemini(userInput, imageBase64);
        } else {
            return this.callMock(userInput, imageBase64);
        }
    }

    // Call real Gemini 1.5 Flash API
    async callGemini(userInput, imageBase64 = null) {
        const apiKey = this.apiKey;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // Initialize system instruction for oral practice
        const systemInstruction = {
            parts: [{
                text: `You are a warm, encouraging English speaking partner and diary assistant. 
The user is a beginner (口语小白) who wants to practice English. 
RULES:
1. ALWAYS reply in English. Keep your English simple, clear, and positive.
2. Reply with only 1 to 2 sentences. Keep it short so the user isn't overwhelmed.
3. If the user talks in Chinese, gently understand them and reply in natural English. Help them translate mentally or prompt them with easy English questions.
4. If a photo is uploaded, actively comment on what you see in the photo in English and ask a follow-up question.
5. Guide the conversation to help them reflect on their day. Ask things like: "Where was this?", "How did you feel?", "What did you do next?".
6. Do NOT output markdown or symbols except basic punctuation.`
            }]
        };

        // Construct current user turn parts
        const userParts = [];
        
        // Add image if present (Gemini base64 structure)
        if (imageBase64) {
            const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            userParts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanBase64
                }
            });
        }
        
        userParts.push({ text: userInput || "Look at this photo I uploaded of my day!" });

        // Add to history
        this.chatHistory.push({
            role: "user",
            parts: userParts
        });

        const requestBody = {
            contents: this.chatHistory,
            systemInstruction: systemInstruction,
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.7
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "Gemini API Error");
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text.trim();
            
            // Add model response to history
            this.chatHistory.push({
                role: "model",
                parts: [{ text: textResponse }]
            });

            return {
                text: textResponse,
                translation: await this.translateTextGemini(textResponse)
            };

        } catch (error) {
            console.error("Gemini API call failed:", error);
            // Fallback to mock if API fails
            return {
                text: "Oh, it seems my connection to the cloud got disrupted! Let's continue using my local voice. Tell me, what was the most interesting part of your day?",
                translation: "噢，看来我和云端的连接被中断了！让我们继续用我的本地语音聊聊吧。告诉我，你今天最有趣的部分是什么？"
            };
        }
    }

    // Call Gemini to translate AI's reply to Chinese
    async translateTextGemini(englishText) {
        const apiKey = this.apiKey;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: `Translate the following English conversation message to natural, conversational Chinese: "${englishText}". Return ONLY the Chinese translation, no extra text.` }]
            }],
            generationConfig: { temperature: 0.2 }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            return data.candidates[0].content.parts[0].text.trim();
        } catch {
            return "翻译加载失败...";
        }
    }

    // Request final diary generation from Gemini API in structured JSON
    async generateDiaryGemini() {
        const apiKey = this.apiKey;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        // We instruct Gemini to compile our history and return JSON
        const historyContext = JSON.stringify(this.chatHistory);
        const prompt = `Based on the following conversation history between me and an English learner, write a beautiful daily diary entry for them.
History: ${historyContext}

Provide the output in JSON format with the following fields:
- "title": A creative title for today's diary in English (e.g. "A Warm Cup of Coffee" or "Afternoon Walk")
- "diaryEn": An English diary paragraph summarizing the day (4-7 sentences, natural but accessible language)
- "diaryZh": The Chinese translation of the diary paragraph
- "vocab": An array of objects representing 3 to 5 useful vocabulary words or phrases learned/related to the entry. Each object has "word" and "translation" (Chinese).

Response MUST be valid JSON matching this schema:
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "diaryEn": { "type": "string" },
    "diaryZh": { "type": "string" },
    "vocab": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "word": { "type": "string" },
          "translation": { "type": "string" }
        },
        "required": ["word", "translation"]
      }
    }
  },
  "required": ["title", "diaryEn", "diaryZh", "vocab"]
}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.5
                    }
                })
            });

            if (!response.ok) throw new Error("Gemini diary generation failed");
            const data = await response.json();
            const jsonText = data.candidates[0].content.parts[0].text;
            return JSON.parse(jsonText);
        } catch (error) {
            console.error("Gemini Diary compilation failed, falling back to local compiler:", error);
            return this.generateMockDiary();
        }
    }

    /* --- Mock Simulator Mode --- */
    callMock(userInput, imageBase64 = null) {
        if (imageBase64) {
            this.mockState.imageUploaded = true;
            this.mockState.currentTurn = 0;
            this.mockState.userResponses = [];
        }

        const inputNormalized = (userInput || '').toLowerCase();
        
        // Topic classification based on simple keyword triggers
        if (inputNormalized.includes('吃') || inputNormalized.includes('饭') || inputNormalized.includes('餐') || inputNormalized.includes('food') || inputNormalized.includes('eat') || inputNormalized.includes('coffee') || inputNormalized.includes('咖啡')) {
            this.mockState.detectedTopic = 'food';
        } else if (inputNormalized.includes('猫') || inputNormalized.includes('狗') || inputNormalized.includes('宠物') || inputNormalized.includes('cat') || inputNormalized.includes('dog') || inputNormalized.includes('pet')) {
            this.mockState.detectedTopic = 'pet';
        } else if (inputNormalized.includes('玩') || inputNormalized.includes('游') || inputNormalized.includes('旅') || inputNormalized.includes('风景') || inputNormalized.includes('travel') || inputNormalized.includes('trip') || inputNormalized.includes('park') || inputNormalized.includes('公园')) {
            this.mockState.detectedTopic = 'travel';
        } else if (inputNormalized.includes('工作') || inputNormalized.includes('写') || inputNormalized.includes('学') || inputNormalized.includes('code') || inputNormalized.includes('work') || inputNormalized.includes('study') || inputNormalized.includes('class')) {
            this.mockState.detectedTopic = 'work';
        }

        if (userInput) {
            this.mockState.userResponses.push(userInput);
        }

        let replyEn = "";
        let replyZh = "";

        // Multistage conversation flow based on state
        if (this.mockState.currentTurn === 0) {
            if (this.mockState.imageUploaded) {
                replyEn = "I see your photo! It looks fascinating. What does this photo show, and what were you doing?";
                replyZh = "我看到了你上传的照片！看起来很有意思。这张照片展示了什么，你当时在做什么呢？";
            } else {
                replyEn = "Hi there! How was your day? Tell me one highlight of your day today.";
                replyZh = "嗨！你今天过得怎么样？告诉我今天最精彩的一件事吧。";
            }
        } else if (this.mockState.currentTurn === 1) {
            const topicReplies = {
                food: [
                    "Yummy! Food always brings joy. Did you cook it yourself or share it with friends?",
                    "美味！美食总能带来快乐。这是你自己做的还是和朋友一起分享的？"
                ],
                pet: [
                    "Aww, so cute! Pets are wonderful companions. What is their name, and what were they doing?",
                    "啊，太可爱了！宠物是极好的伙伴。它叫什么名字，当时在干什么呢？"
                ],
                travel: [
                    "That looks beautiful! I love exploring new places. Who did you go there with?",
                    "这景色真美！我喜欢探索新的地方。你是和谁一起去的？"
                ],
                work: [
                    "Ah, it looks like a busy, productive day! Are you working on a new project or studying?",
                    "啊，看起来是忙碌而充实的一天！你是在做一个新项目还是在学习？"
                ],
                general: [
                    "That sounds very interesting. How did you feel when this happened?",
                    "听起来很有意思。当这件事发生的时候，你感觉如何？"
                ]
            };
            const activeReply = topicReplies[this.mockState.detectedTopic] || topicReplies.general;
            replyEn = activeReply[0];
            replyZh = activeReply[1];
        } else if (this.mockState.currentTurn === 2) {
            replyEn = "I understand. Thank you for sharing your stories with me in English! It is a great practice. What is your plan for the evening or tomorrow?";
            replyZh = "我明白了。谢谢你用英语和我分享你的故事！这是一个很好的练习。你今晚或明天有什么计划吗？";
        } else {
            replyEn = "Wonderful! It was great chatting with you today. Click the button below whenever you're ready to compile your diary!";
            replyZh = "太棒了！今天和你聊天非常愉快。当你准备好整理日记时，点击下方的按钮即可！";
        }

        this.mockState.currentTurn++;

        // Add to history list to keep record
        this.chatHistory.push({ role: "user", parts: [{ text: userInput || "Upload Image" }] });
        this.chatHistory.push({ role: "model", parts: [{ text: replyEn }] });

        return {
            text: replyEn,
            translation: replyZh
        };
    }

    // Local Diary Compiler based on keywords & state
    generateMockDiary() {
        const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' });
        
        const templates = {
            food: {
                title: "A Culinary Delight",
                diaryEn: `Today was all about savoring delicious food. I captured a picture of a wonderful dish. Food is not just about eating; it is an experience that brings comfort and happiness. I either cooked this delicious meal or shared it with wonderful company. It was a delightful moment in my day that made me feel relaxed and satisfied.`,
                diaryZh: `今天是关于品尝美食的一天。我拍下了一道美味菜肴的照片。食物不仅仅是为了填饱肚子，它更是一种带来舒适与幸福的体验。我或者自己烹饪了这顿美餐，或者与美好的伙伴一同分享。这是我一天中令人愉悦的时刻，让我感到放松和满足。`,
                vocab: [
                    { word: "Savor", translation: "品尝，细细品味" },
                    { word: "Culinary", translation: "烹饪的，厨房的" },
                    { word: "Delightful", translation: "令人愉悦的" },
                    { word: "Satisfied", translation: "感到满足的" }
                ]
            },
            pet: {
                title: "Moments with My Cute Companion",
                diaryEn: `Today, I spent some heartwarming time with a lovely pet. Pets have a unique way of bringing pure joy and peace into our busy lives. Looking at their adorable face immediately melted away my tiredness. It is truly a blessing to have such a faithful companion to share the simple moments of life.`,
                diaryZh: `今天，我和可爱的宠物度过了一段温馨的时光。在忙碌的生活中，宠物有着独特的方式能带来纯粹的快乐与和平。看着它们可爱的脸庞，我的疲惫立刻融化了。拥有这样一个忠实的伙伴来分享生活中简单的瞬间，真是一种福气。`,
                vocab: [
                    { word: "Heartwarming", translation: "暖心的" },
                    { word: "Adorable", translation: "可爱的，讨人喜欢的" },
                    { word: "Blessing", translation: "福祉，幸事" },
                    { word: "Companion", translation: "伴侣，同伴" }
                ]
            },
            travel: {
                title: "Exploring New Views",
                diaryEn: `Today, I went out and explored a beautiful place. The scenic views were refreshing and took my breath away. It is always exciting to step outside, discover new environments, and experience nature or new landmarks. This trip made me feel energetic and gave me wonderful memories to cherish.`,
                diaryZh: `今天，我走出去探索了一个美丽的地方。美丽的风景令人耳目一新，美得令人窒息。走出家门，发现新环境，体验大自然或新地标，总是令人兴奋。这次旅行让我感到充满活力，并留下了值得珍藏的美好回忆。`,
                vocab: [
                    { word: "Scenic", translation: "风景优美的" },
                    { word: "Refreshing", translation: "提神的，使人耳目一新的" },
                    { word: "Cherish", translation: "珍爱，珍惜" },
                    { word: "Step outside", translation: "走到户外" }
                ]
            },
            work: {
                title: "A Productive and Focused Day",
                diaryEn: `Today was a very productive day focused on goals. I spent solid time working, studying, or learning new knowledge. Although it required deep focus and effort, finishing the tasks gave me a great sense of accomplishment. Step by step, I am improving and moving forward on my path.`,
                diaryZh: `今天是非常高效、专注于目标的一天。我花了充实的时间工作、学习或掌握新知识。虽然这需要高度的专注和努力，但完成任务给我带来了极大的成就感。一步一步地，我正在我的道路上不断进步和前行。`,
                vocab: [
                    { word: "Productive", translation: "高效的，多产的" },
                    { word: "Accomplishment", translation: "成就，成就感" },
                    { word: "Deep focus", translation: "深度专注" },
                    { word: "Step by step", translation: "一步一步地" }
                ]
            },
            general: {
                title: "Capturing a Beautiful Day",
                diaryEn: `Today was filled with memorable events. I uploaded a photo representing a meaningful slice of my day. Practicing English conversation helped me look back on what happened and think in a new language. Reflecting on my day allows me to appreciate the little details that make life beautiful and worth documenting.`,
                diaryZh: `今天充满了值得纪念的事情。我上传了一张照片，代表了我一天中意义深切的切片。练习英语对话帮我回顾了发生的事情，并用新的语言进行思考。对一天的反思让我能够欣赏使生活变得美丽且值得记录的细节。`,
                vocab: [
                    { word: "Memorable", translation: "值得纪念的" },
                    { word: "Reflect on", translation: "反思，回顾" },
                    { word: "Appreciate", translation: "感激，欣赏" },
                    { word: "Document", translation: "记录，文献" }
                ]
            }
        };

        const activeTemplate = templates[this.mockState.detectedTopic] || templates.general;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    title: activeTemplate.title,
                    diaryEn: activeTemplate.diaryEn,
                    diaryZh: activeTemplate.diaryZh,
                    vocab: activeTemplate.vocab
                });
            }, 1000); // Simulate API latency
        });
    }
}
