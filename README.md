<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Texto a Voz con Gemini</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Estilo para el indicador de carga */
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gray-900 text-white font-sans flex items-center justify-center min-h-screen">

    <div class="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <h1 class="text-3xl font-bold mb-2 text-center text-blue-400">Texto a Voz con IA</h1>
        <p class="text-gray-400 mb-6 text-center">Escribe cualquier texto, selecciona una voz y escucha la magia.</p>

        <div class="space-y-4">
            <!-- Área de texto para la entrada del usuario -->
            <textarea id="text-input" class="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Escribe aquí tu texto..."></textarea>

            <!-- Menú desplegable para seleccionar la voz -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
                <div class="flex-1">
                    <label for="voice-select" class="block text-sm font-medium text-gray-400 mb-1">Elige una voz</label>
                    <select id="voice-select" class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                        <option value="Kore">Kore (Firme)</option>
                        <option value="Puck">Puck (Alegre)</option>
                        <option value="Zephyr">Zephyr (Brillante)</option>
                        <option value="Charon">Charon (Informativo)</option>
                        <option value="Leda">Leda (Juvenil)</option>
                        <option value="Aoede">Aoede (Fresca)</option>
                        <option value="Callirrhoe">Callirrhoe (Relajada)</option>
                        <option value="Sadachbia">Sadachbia (Vivaz)</option>
                        <option value="Sulafat">Sulafat (Cálida)</option>
                    </select>
                </div>
                
                <!-- Botón para generar el audio -->
                <button id="generate-button" class="w-full sm:w-auto self-end bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out flex items-center justify-center">
                    <span id="button-text">Generar Audio</span>
                    <div id="loader" class="loader hidden ml-2"></div>
                </button>
            </div>
        </div>

        <!-- Controles de audio para reproducir el resultado -->
        <div class="mt-6">
             <p id="error-message" class="text-red-400 text-center mb-4 hidden"></p>
            <audio id="audio-player" controls class="w-full hidden"></audio>
        </div>
    </div>

    <script>
        const generateButton = document.getElementById('generate-button');
        const buttonText = document.getElementById('button-text');
        const loader = document.getElementById('loader');
        const textInput = document.getElementById('text-input');
        const voiceSelect = document.getElementById('voice-select');
        const audioPlayer = document.getElementById('audio-player');
        const errorMessage = document.getElementById('error-message');

        const apiKey = "AIzaSyAVSVkl0Wt1NtOvVcuoe1gUB8MjUp6PMH8"; // La clave de API se inyectará en tiempo de ejecución
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

        /**
         * Decodifica una cadena base64 a un ArrayBuffer.
         * @param {string} base64 - La cadena base64 a decodificar.
         * @returns {ArrayBuffer} - El ArrayBuffer decodificado.
         */
        function base64ToArrayBuffer(base64) {
            const binaryString = window.atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        /**
         * Convierte datos de audio PCM a formato WAV.
         * La API devuelve audio PCM crudo, pero el navegador necesita un contenedor WAV para reproducirlo.
         * @param {Int16Array} pcmData - Los datos PCM de 16 bits.
         * @param {number} sampleRate - La frecuencia de muestreo del audio.
         * @returns {Blob} - Un Blob que contiene los datos de audio en formato WAV.
         */
        function pcmToWav(pcmData, sampleRate) {
            const numChannels = 1;
            const bytesPerSample = 2; // 16-bit
            const blockAlign = numChannels * bytesPerSample;
            const byteRate = sampleRate * blockAlign;
            const dataSize = pcmData.length * bytesPerSample;
            const buffer = new ArrayBuffer(44 + dataSize);
            const view = new DataView(buffer);

            // Escribir la cabecera del archivo WAV
            // RIFF chunk descriptor
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            // "fmt " sub-chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true); // Audio format (1 for PCM)
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, byteRate, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, 16, true); // Bits per sample
            // "data" sub-chunk
            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);

            // Escribir los datos PCM
            const pcm16 = new Int16Array(buffer, 44);
            pcm16.set(pcmData);

            return new Blob([view], { type: 'audio/wav' });
        }
        
        /**
         * Helper para escribir una cadena en un DataView.
         */
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }


        /**
         * Función principal para generar y reproducir el audio.
         */
        async function generateAndPlayAudio() {
            const text = textInput.value.trim();
            if (!text) {
                showError("Por favor, introduce algo de texto.");
                return;
            }

            // Actualizar UI para estado de carga
            setLoading(true);
            hideError();
            audioPlayer.classList.add('hidden');
            
            const payload = {
                contents: [{
                    parts: [{ text: text }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceSelect.value }
                        }
                    }
                },
                model: "gemini-2.5-flash-preview-tts"
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                const part = result?.candidates?.[0]?.content?.parts?.[0];
                const audioData = part?.inlineData?.data;
                const mimeType = part?.inlineData?.mimeType;

                if (audioData && mimeType && mimeType.startsWith("audio/")) {
                    const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                    if (!sampleRateMatch) throw new Error("No se pudo encontrar la frecuencia de muestreo en la respuesta.");
                    
                    const sampleRate = parseInt(sampleRateMatch[1], 10);
                    const pcmData = base64ToArrayBuffer(audioData);
                    const pcm16 = new Int16Array(pcmData);

                    const wavBlob = pcmToWav(pcm16, sampleRate);
                    const audioUrl = URL.createObjectURL(wavBlob);

                    audioPlayer.src = audioUrl;
                    audioPlayer.classList.remove('hidden');
                    audioPlayer.play();
                } else {
                    throw new Error("Respuesta de la API inválida o sin datos de audio.");
                }

            } catch (error) {
                console.error("Error al generar audio:", error);
                showError("No se pudo generar el audio. Inténtalo de nuevo.");
            } finally {
                setLoading(false);
            }
        }

        function setLoading(isLoading) {
            if (isLoading) {
                generateButton.disabled = true;
                buttonText.classList.add('hidden');
                loader.classList.remove('hidden');
            } else {
                generateButton.disabled = false;
                buttonText.classList.remove('hidden');
                loader.classList.add('hidden');
            }
        }
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        }

        function hideError() {
            errorMessage.classList.add('hidden');
        }

        generateButton.addEventListener('click', generateAndPlayAudio);
    </script>

</body>
</html>
