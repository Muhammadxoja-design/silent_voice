(function () {
  const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }

  const recognizedText = document.getElementById('recognizedText');
  const speakBtn = document.getElementById('speakBtn');
  const vibrateBtn = document.getElementById('vibrateBtn');
  const gpsBtn = document.getElementById('gpsBtn');
  const cameraEl = document.getElementById('camera');
  const overlayCanvas = document.getElementById('overlay');
  const demoButtons = document.querySelectorAll('.camera-demo-btn');
  const permissionModal = document.getElementById('cameraPermissionModal');
  const permissionBtn = document.getElementById('cameraPermissionBtn');
  const modalCloseBtn = document.getElementById('cameraModalCloseBtn');
  let cameraStream = null;
  let recognitionIntervalId = null;
  let isSendingFrame = false;
  let handsDetector = null;
  let lastHandSeenAt = 0;
  let consecutiveUnknownCount = 0;
  let lastRenderedTranslation = '';
  const predictionBuffer = [];
  const RECOGNITION_INTERVAL_MS = 1800;
  const MAX_PREDICTION_BUFFER = 4;
  let currentText = 'Waiting...';

  function setRecognized(text, { force = false } = {}) {
    currentText = text || 'Waiting...';
    if (recognizedText && (force || currentText !== lastRenderedTranslation)) {
      recognizedText.textContent = currentText;
      lastRenderedTranslation = currentText;
    }
  }

  function closeModal() {
    permissionModal?.classList.remove('is-visible');
  }

  function openModal() {
    permissionModal?.classList.add('is-visible');
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

  function stopCamera() {
    clearRecognitionLoop();
    isSendingFrame = false;
    consecutiveUnknownCount = 0;
    predictionBuffer.length = 0;
    lastHandSeenAt = 0;
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if (cameraEl) {
      cameraEl.srcObject = null;
      cameraEl.onloadedmetadata = null;
    }
  }

  function captureFrameAsBase64() {
    if (!cameraEl || !overlayCanvas || !cameraEl.videoWidth || !cameraEl.videoHeight) {
      return null;
    }

    const targetWidth = 640;
    const scale = targetWidth / cameraEl.videoWidth;
    const targetHeight = Math.max(360, Math.round(cameraEl.videoHeight * scale));

    overlayCanvas.width = targetWidth;
    overlayCanvas.height = targetHeight;

    const context = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(cameraEl, 0, 0, targetWidth, targetHeight);
    return overlayCanvas.toDataURL('image/jpeg', 0.76);
  }

  function setupHandsDetector() {
    if (!window.Hands || handsDetector) {
      return;
    }

    handsDetector = new window.Hands({
      locateFile(file) {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    handsDetector.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    handsDetector.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lastHandSeenAt = Date.now();
      }
    });
  }

  async function detectHandPresence() {
    if (!handsDetector || !cameraEl || cameraEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return true;
    }

    try {
      await handsDetector.send({ image: cameraEl });
      return Date.now() - lastHandSeenAt < 2000;
    } catch (error) {
      return true;
    }
  }

  async function requestRecognition() {
    if (isSendingFrame || !cameraEl || cameraEl.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return;
    }

    isSendingFrame = true;

    const handVisible = await detectHandPresence();
    if (!handVisible) {
      isSendingFrame = false;
      return;
    }

    const image = captureFrameAsBase64();
    if (!image) {
      isSendingFrame = false;
      return;
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Recognition failed.');
      }

      const prediction = normalizePrediction(data.text);

      if (!prediction || prediction === 'Aniqlanmadi') {
        consecutiveUnknownCount += 1;
        if (consecutiveUnknownCount >= 3 && !lastRenderedTranslation) {
          setRecognized('Aniqlanmadi');
        }
        return;
      }

      consecutiveUnknownCount = 0;
      rememberPrediction(prediction);
      const stablePrediction = getStablePrediction();

      if (stablePrediction) {
        setRecognized(stablePrediction);
      }
    } catch (error) {
      setRecognized('Tarjima vaqtida xatolik yuz berdi.');
      console.error('Live camera recognition error:', error);
    } finally {
      isSendingFrame = false;
    }
  }

  function startRecognitionLoop() {
    clearRecognitionLoop();
    setRecognized("Kamera ishlayapti. Qo'lingizni ko'rsating...", { force: true });
    recognitionIntervalId = window.setInterval(() => {
      requestRecognition();
    }, RECOGNITION_INTERVAL_MS);
    requestRecognition();
  }

  demoButtons.forEach((btn) => btn.addEventListener('click', () => setRecognized(btn.dataset.text)));

  speakBtn?.addEventListener('click', () => {
    const utterance = new SpeechSynthesisUtterance(currentText);
    speechSynthesis.speak(utterance);
  });

  vibrateBtn?.addEventListener('click', () => {
    if (navigator.vibrate) {
      navigator.vibrate([120, 40, 120]);
    }
  });

  gpsBtn?.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      setRecognized('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const payload = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setRecognized(`SOS queued for ${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`);
    }, () => {
      setRecognized('Location permission denied');
    });
  });

  async function startCamera() {
    try {
      stopCamera();
      setupHandsDetector();
      predictionBuffer.length = 0;
      consecutiveUnknownCount = 0;

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      if (cameraEl) {
        cameraEl.srcObject = cameraStream;
        await cameraEl.play();
      }

      closeModal();
      setRecognized("Kamera yoqildi. Qo'lingizni ko'rsating...", { force: true });

      if (cameraEl) {
        const startLoop = () => startRecognitionLoop();
        if (cameraEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          startLoop();
        } else {
          cameraEl.onloadedmetadata = startLoop;
        }
      }
    } catch (error) {
      setRecognized("Kameraga ruxsat berilmadi. Demo tugmalaridan foydalaning.");
      openModal();
    }
  }

  permissionBtn?.addEventListener('click', () => {
    startCamera();
  });

  modalCloseBtn?.addEventListener('click', () => {
    closeModal();
    stopCamera();
    setRecognized('Demo mode active. Use gesture buttons below.');
  });

  window.addEventListener('beforeunload', () => {
    stopCamera();
  });

  openModal();
})();
