(function () {
  const root = document.querySelector('.hero-live-preview');
  if (!root) {
    return;
  }

  const videoEl = document.getElementById('homeCamera');
  const canvasEl = document.getElementById('homeCameraCanvas');
  const placeholderEl = document.getElementById('homeCameraPlaceholder');
  const recognizedEl = document.getElementById('homeRecognizedText');
  const statusEl = document.getElementById('homeRecognitionStatus');
  const transcriptEl = document.getElementById('homeTranscript');
  const toggleBtn = document.getElementById('homeCameraToggleBtn');
  const endpoint = root.dataset.translatorEndpoint || '/api/translate';

  let cameraStream = null;
  let recognitionIntervalId = null;
  let isSendingFrame = false;
  let consecutiveUnknownCount = 0;
  const predictionBuffer = [];
  const transcriptItems = [];

  const RECOGNITION_INTERVAL_MS = 2400;
  const MAX_PREDICTION_BUFFER = 4;
  const MAX_TRANSCRIPT_ITEMS = 4;

  function setRecognized(text) {
    if (recognizedEl) {
      recognizedEl.textContent = text || "Kamerani yoqing va imo-ishora qiling";
    }
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text || '';
    }
  }

  function renderTranscript() {
    if (!transcriptEl) {
      return;
    }

    transcriptEl.innerHTML = '';

    if (!transcriptItems.length) {
      const fallbackChip = document.createElement('span');
      fallbackChip.className = 'chip';
      fallbackChip.textContent = 'AI tayyor';
      transcriptEl.appendChild(fallbackChip);
      return;
    }

    transcriptItems.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = item;
      transcriptEl.appendChild(chip);
    });
  }

  function rememberTranscript(text) {
    if (!text || text === 'Aniqlanmadi') {
      return;
    }

    if (transcriptItems[0] === text) {
      return;
    }

    transcriptItems.unshift(text);

    while (transcriptItems.length > MAX_TRANSCRIPT_ITEMS) {
      transcriptItems.pop();
    }

    renderTranscript();
  }

  function normalizePrediction(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function rememberPrediction(text) {
    predictionBuffer.push(text);

    while (predictionBuffer.length > MAX_PREDICTION_BUFFER) {
      predictionBuffer.shift();
    }
  }

  function getStablePrediction() {
    const counts = new Map();

    predictionBuffer.forEach((item) => {
      if (!item || item === 'Aniqlanmadi') {
        return;
      }

      counts.set(item, (counts.get(item) || 0) + 1);
    });

    let bestText = '';
    let bestCount = 0;

    counts.forEach((count, text) => {
      if (count > bestCount) {
        bestText = text;
        bestCount = count;
      }
    });

    if (bestCount >= 2) {
      return bestText;
    }

    const latest = predictionBuffer[predictionBuffer.length - 1];
    return latest && latest !== 'Aniqlanmadi' ? latest : '';
  }

  function clearRecognitionLoop() {
    if (recognitionIntervalId) {
      window.clearInterval(recognitionIntervalId);
      recognitionIntervalId = null;
    }
  }

  function setCameraVisible(isVisible) {
    if (videoEl) {
      videoEl.classList.toggle('hidden', !isVisible);
    }

    if (placeholderEl) {
      placeholderEl.classList.toggle('hidden', isVisible);
    }
  }

  function stopCamera({ preserveMessage = false } = {}) {
    clearRecognitionLoop();
    isSendingFrame = false;
    consecutiveUnknownCount = 0;
    predictionBuffer.length = 0;

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
    }

    setCameraVisible(false);

    if (toggleBtn) {
      toggleBtn.textContent = 'Kamerani yoqish';
    }

    if (!preserveMessage) {
      setRecognized("Kamerani yoqing va imo-ishora qiling");
      setStatus('Preview rejimi tayyor');
    }
  }

  function captureFrameAsBase64() {
    if (!videoEl || !canvasEl || !videoEl.videoWidth || !videoEl.videoHeight) {
      return null;
    }

    const targetWidth = 576;
    const scale = targetWidth / videoEl.videoWidth;
    const targetHeight = Math.max(320, Math.round(videoEl.videoHeight * scale));

    canvasEl.width = targetWidth;
    canvasEl.height = targetHeight;

    const context = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
    return canvasEl.toDataURL('image/jpeg', 0.76);
  }

  async function requestRecognition() {
    if (isSendingFrame || !videoEl || videoEl.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return;
    }

    const image = captureFrameAsBase64();
    if (!image) {
      return;
    }

    isSendingFrame = true;
    setStatus('AI ishorani tahlil qilmoqda...');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Tarjima bajarilmadi.');
      }

      const prediction = normalizePrediction(data.text);

      if (!prediction || prediction === 'Aniqlanmadi') {
        consecutiveUnknownCount += 1;
        if (consecutiveUnknownCount >= 2) {
          setRecognized('Aniqlanmadi');
          setStatus("Ishora aniq ko'rinmadi, qayta ko'rsating.");
        }
        return;
      }

      consecutiveUnknownCount = 0;
      rememberPrediction(prediction);
      const stablePrediction = getStablePrediction();

      if (stablePrediction) {
        setRecognized(stablePrediction);
        setStatus("AI foydalanuvchi ko'rsatayotgan ishorani tarjima qildi.");
        rememberTranscript(stablePrediction);
      }
    } catch (error) {
      setStatus('AI hozircha javob bermadi. API kalitini tekshiring.');
      setRecognized('Tarjima vaqtida xatolik yuz berdi.');
      console.error('Home live preview recognition error:', error);
    } finally {
      isSendingFrame = false;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecognized("Bu brauzer kamerani qo'llamaydi.");
      setStatus('Qurilmada kamera API mavjud emas.');
      return;
    }

    try {
      stopCamera({ preserveMessage: true });
      predictionBuffer.length = 0;
      consecutiveUnknownCount = 0;

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user'
        },
        audio: false
      });

      if (videoEl) {
        videoEl.srcObject = cameraStream;
        await videoEl.play();
      }

      setCameraVisible(true);

      if (toggleBtn) {
        toggleBtn.textContent = "Kamerani to'xtatish";
      }

      setRecognized("AI tinglayapti. Qo'lingizni ko'rsating...");
      setStatus("Ishora qiling, tarjima pastda ko'rinadi.");

      clearRecognitionLoop();
      recognitionIntervalId = window.setInterval(requestRecognition, RECOGNITION_INTERVAL_MS);
      requestRecognition();
    } catch (error) {
      stopCamera({ preserveMessage: true });
      setRecognized('Kameraga ruxsat berilmadi.');
      setStatus("Brauzer kameraga ruxsat so'radi yoki foydalanuvchi rad etdi.");
      console.error('Home live preview camera error:', error);
    }
  }

  toggleBtn?.addEventListener('click', () => {
    if (cameraStream) {
      stopCamera();
      return;
    }

    startCamera();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && cameraStream) {
      stopCamera({ preserveMessage: true });
      setStatus("Sahifa yashirilgani uchun kamera to'xtatildi.");
    }
  });

  window.addEventListener('beforeunload', () => {
    stopCamera({ preserveMessage: true });
  });

  renderTranscript();
})();
