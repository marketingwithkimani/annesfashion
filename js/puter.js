/**
 * Putter.js - Client-side wrapper for NanoBanana AI Generation via Puter.js
 */

const Putter = {
    /**
     * Converts an image element to a Base64 string using Canvas.
     * This avoids CORS issues with local file:// or localhost URLs.
     * @param {HTMLImageElement} imgElement - The loaded image element.
     * @returns {string} - The Base64 string (without data URI prefix).
     */
    toBase64: function (imgElement) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);

            // Get data URL (default png)
            const dataURL = canvas.toDataURL('image/png');

            // Remove prefix
            return dataURL.split(',')[1];
        } catch (error) {
            console.error('Error converting image to Base64:', error);
            throw error;
        }
    },

    /**
     * Chat with the AI model.
     * @param {string} message - The user's message.
     * @param {string} systemPrompt - The system instructions/persona.
     * @returns {Promise<string>} - The AI's response.
     */
    chat: async function (message, systemPrompt) {
        if (!window.puter || !window.puter.ai) {
            throw new Error('Putter.js library not loaded');
        }

        try {
            const response = await window.puter.ai.chat(message, {
                system: systemPrompt,
                model: 'gpt-4o-mini'
            });
            // Puter.ai chat usually returns { message: { role: 'assistant', content: '...' } } or similar object
            // Just returning the content string
            return response?.message?.content || response?.toString() || "I'm speachless!";
        } catch (error) {
            console.error('Chat Failed:', error);
            throw error;
        }
    },

    nanoBanana: {
        /**
         * Generate an image based on a text prompt using Puter.ai.
         * @param {Object} options - { prompt: string, imageElement: HTMLImageElement }
         * @returns {Promise<Object>} - Resolves with { url: string }
         */
        generate: async function (options) {
            console.log('[Putter.js] Generating with prompt:', options.prompt);

            if (!window.puter || !window.puter.ai) {
                console.error('Putter.js library not loaded. Make sure the script is included.');
                throw new Error('Putter.js library not loaded');
            }

            try {
                // Get Base64 of the current product image (synchronous now via canvas)
                const base64Image = Putter.toBase64(options.imageElement);

                // Call Puter AI (using Gemini Flash Preview as per example)
                const resultImage = await window.puter.ai.txt2img(options.prompt, {
                    model: 'gemini-2.5-flash-image-preview',
                    input_image: base64Image,
                    input_image_mime_type: 'image/png'
                });

                // resultImage is an HTMLImageElement
                return {
                    success: true,
                    url: resultImage.src
                };

            } catch (error) {
                console.error('Generation Failed:', error);
                throw error;
            }
        }
    }
};

window.Putter = Putter;
