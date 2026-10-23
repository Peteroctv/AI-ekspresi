
/* =========================================
   AI EXPRESSION LAB — FINAL JAVASCRIPT
   Teachable Machine + TensorFlow.js
========================================= */

"use strict";

// =========================================
// 1. ELEMEN HTML
// =========================================

const $ = (id) => document.getElementById(id);

const modelForm = $("model-form");
const modelUrlInput = $("model-url");
const loadModelBtn = $("load-model-btn");
const loadButtonIcon = $("load-button-icon");
const loadButtonText = $("load-button-text");

const startBtn = $("start-btn");
const stopBtn = $("stop-btn");
const copyBtn = $("copy-btn");

const statusText = $("status");
const statusIndicator = $("status-indicator");
const urlMessage = $("url-message");
const message = $("message");

const webcamContainer = $("webcam-container");
const placeholder = $("placeholder");
const cameraBadge = $("camera-badge");
const cameraLabel = $("camera-label");

const topExpression = $("top-expression");
const topScore = $("top-score");
const confidenceRing = $("confidence-ring");
const ringScore = $("ring-score");
const predictionsBox = $("predictions");
const classCount = $("class-count");
const lastUpdated = $("last-updated");

// =========================================
// 2. STATE APLIKASI
// =========================================

let model = null;
let webcam = null;

let modelURL = "";
let loadedModelURL = "";

let running = false;
let startingCamera = false;
let loadingModel = false;

let animationId = null;
let sessionId = 0;
let lastPredictions = [];

const DEFAULT_EXPRESSION = "Menunggu analisis";

// =========================================
// 3. FUNGSI TAMPILAN
// =========================================

function setStatus(text, type = "normal") {
    statusText.textContent = text;

    statusIndicator.classList.remove(
        "ready",
        "busy",
        "error"
    );

    if (type === "ready") {
        statusIndicator.classList.add("ready");
    } else if (type === "busy") {
        statusIndicator.classList.add("busy");
    } else if (type === "error") {
        statusIndicator.classList.add("error");
    }
}

function setMessage(text) {
    message.textContent = text;
}

function setURLMessage(text, type = "normal") {
    urlMessage.textContent = text;

    urlMessage.classList.remove("success", "error");

    if (type === "success" || type === "error") {
        urlMessage.classList.add(type);
    }
}

function setCameraState(active) {
    cameraBadge.classList.toggle("active", active);

    cameraBadge.lastChild.textContent =
        active ? " LIVE" : " STANDBY";

    cameraLabel.textContent =
        active ? "CAMERA LIVE" : "CAMERA OFF";
}

// =========================================
// 4. VALIDASI URL MODEL
// =========================================

function getModelBaseURL(value) {
    const input = value.trim();

    if (!input) {
        throw new Error(
            "Masukkan URL model Teachable Machine terlebih dahulu."
        );
    }

    let parsedURL;

    try {
        parsedURL = new URL(input);
    } catch {
        throw new Error("Format URL tidak valid.");
    }

    if (parsedURL.protocol !== "https:") {
        throw new Error(
            "URL model harus menggunakan HTTPS."
        );
    }

    if (
        parsedURL.hostname !==
        "teachablemachine.withgoogle.com"
    ) {
        throw new Error(
            "Gunakan URL model dari Teachable Machine."
        );
    }

    if (parsedURL.search || parsedURL.hash) {
        throw new Error(
            "Hapus parameter tambahan dari URL model."
        );
    }

    const path = parsedURL.pathname.replace(/\/+$/, "");

    if (
        !path.startsWith("/models/") ||
        path.length <= "/models/".length
    ) {
        throw new Error(
            "URL harus mengarah ke model hasil ekspor Teachable Machine."
        );
    }

    return parsedURL.origin + path + "/";
}

// =========================================
// 5. STATUS TOMBOL MODEL
// =========================================

function setModelLoadingState(loading) {
    loadModelBtn.disabled = loading;
    loadButtonIcon.textContent = loading ? "…" : "↓";

    loadButtonText.textContent = loading
        ? "Memuat..."
        : "Muat Model";
}

// =========================================
// 6. MEMUAT MODEL AI
// =========================================

async function loadModel(options = {}) {
    const fromStart = options.fromStart === true;

    if (running || (startingCamera && !fromStart)) {
        setURLMessage(
            "Hentikan kamera sebelum mengganti model.",
            "error"
        );

        return false;
    }

    if (loadingModel) {
        return false;
    }

    let newURL;

    try {
        newURL = getModelBaseURL(modelUrlInput.value);
    } catch (error) {
        setURLMessage(error.message, "error");
        return false;
    }

    // Gunakan model yang sudah dimuat jika URL sama.
    if (model && loadedModelURL === newURL) {
        setURLMessage(
            "Model sudah berhasil dimuat dan siap digunakan.",
            "success"
        );

        setStatus("Model siap", "ready");
        startBtn.disabled = false;

        return true;
    }

    if (!window.tmImage) {
        setURLMessage(
            "Pustaka AI gagal dimuat. Periksa koneksi internet.",
            "error"
        );

        setStatus("Pustaka AI tidak tersedia", "error");
        return false;
    }

    loadingModel = true;
    setModelLoadingState(true);

    startBtn.disabled = true;

    setStatus("Memuat model AI...", "busy");

    setURLMessage(
        "Sedang mengunduh model. Mohon tunggu..."
    );

    try {
        const loadedModel = await tmImage.load(
            newURL + "model.json",
            newURL + "metadata.json"
        );

        // Jangan mengganti state kamera yang sedang aktif.
        if (running) {
            throw new Error(
                "Hentikan kamera sebelum mengganti model."
            );
        }

        model = loadedModel;
        modelURL = newURL;
        loadedModelURL = newURL;

        setURLMessage(
            "Model berhasil dimuat. Kamera siap digunakan.",
            "success"
        );

        setStatus("Model siap", "ready");

        setMessage(
            "Model AI siap. Tekan Mulai Kamera untuk menganalisis ekspresi."
        );

        startBtn.disabled = false;

        return true;

    } catch (error) {
        console.error("Model gagal dimuat:", error);

        model = null;
        modelURL = "";
        loadedModelURL = "";

        setURLMessage(
            "Gagal memuat model. Periksa URL dan koneksi internet.",
            "error"
        );

        setStatus("Model gagal dimuat", "error");

        setMessage(
            "Pastikan URL benar dan model.json serta metadata.json tersedia."
        );

        startBtn.disabled = true;

        return false;

    } finally {
        loadingModel = false;
        setModelLoadingState(false);
    }
}

// =========================================
// 7. EVENT FORM URL
// =========================================

modelForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (running || startingCamera) {
        setURLMessage(
            "Hentikan kamera terlebih dahulu.",
            "error"
        );
        return;
    }

    const success = await loadModel();

    if (success) {
        resetResults();
    }
});

// =========================================
// 8. RESET HASIL
// =========================================

function resetResults() {
    lastPredictions = [];

    topExpression.textContent = DEFAULT_EXPRESSION;
    topScore.textContent = "--";

    confidenceRing.style.setProperty(
        "--progress",
        "0deg"
    );

    ringScore.textContent = "0%";
    classCount.textContent = "0 kelas";
    lastUpdated.textContent = "Belum ada analisis";

    copyBtn.disabled = true;

    predictionsBox.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-result";

    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "⌁";

    const text = document.createElement("p");
    text.textContent =
        "Hasil prediksi akan muncul di sini.";

    empty.append(icon, text);
    predictionsBox.appendChild(empty);
}

// =========================================
// 9. MULAI KAMERA
// =========================================

async function startCamera() {
    if (running || startingCamera || loadingModel) {
        return;
    }

    if (
        !window.isSecureContext ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        setStatus("Koneksi tidak aman", "error");

        setMessage(
            "Kamera membutuhkan HTTPS atau localhost. " +
            "Jalankan melalui server lokal atau hosting HTTPS."
        );

        return;
    }

    startingCamera = true;
    startBtn.disabled = true;

    const currentSession = ++sessionId;
    let pendingWebcam = null;

    try {
        const currentURL = getModelBaseURL(
            modelUrlInput.value
        );

        // Muat model jika belum tersedia atau URL berubah.
        if (
            !model ||
            loadedModelURL !== currentURL
        ) {
            const success = await loadModel({
                fromStart: true
            });

            if (!success) {
                return;
            }
        }

        if (
            !startingCamera ||
            currentSession !== sessionId
        ) {
            return;
        }

        setStatus("Menyiapkan kamera...", "busy");

        setMessage(
            "Meminta izin kamera dari browser..."
        );

        pendingWebcam = new tmImage.Webcam(
            480,
            360,
            true
        );

        await pendingWebcam.setup();

        // Pengguna mungkin sudah menekan Hentikan.
        if (
            !startingCamera ||
            currentSession !== sessionId
        ) {
            pendingWebcam.stop();
            pendingWebcam = null;
            return;
        }

        await pendingWebcam.play();

        if (
            !startingCamera ||
            currentSession !== sessionId
        ) {
            pendingWebcam.stop();
            pendingWebcam = null;
            return;
        }

        webcam = pendingWebcam;
        pendingWebcam = null;

        webcamContainer.replaceChildren(
            webcam.canvas
        );

        placeholder.hidden = true;

        // Ikuti ukuran frame agar kamera tidak meluber.
        webcam.canvas.style.width = "100%";
        webcam.canvas.style.height = "100%";
        webcam.canvas.style.objectFit = "contain";

        running = true;

        stopBtn.disabled = false;
        startBtn.disabled = true;

        setCameraState(true);
        setStatus("Kamera aktif", "ready");

        setMessage(
            "Kamera aktif. AI sedang menganalisis gambar."
        );

        resetResults();

        animationId = requestAnimationFrame(
            () => predictLoop(currentSession)
        );

    } catch (error) {
        console.error(
            "Gagal memulai kamera:",
            error
        );

        if (pendingWebcam) {
            try {
                pendingWebcam.stop();
            } catch (_) {}
        }

        if (webcam) {
            try {
                webcam.stop();
            } catch (_) {}

            webcam = null;
        }

        webcamContainer.replaceChildren();
        placeholder.hidden = false;

        setCameraState(false);
        stopBtn.disabled = true;

        setStatus("Kamera tidak aktif", "error");

        if (
            error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError"
        ) {
            setMessage(
                "Izin kamera ditolak. Izinkan kamera melalui pengaturan izin situs browser."
            );

        } else if (
            error.name === "NotFoundError" ||
            error.name === "DevicesNotFoundError"
        ) {
            setMessage(
                "Kamera tidak ditemukan. Periksa kamera perangkat."
            );

        } else if (
            error.name === "NotReadableError"
        ) {
            setMessage(
                "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi."
            );

        } else {
            setMessage(
                "Kamera gagal dijalankan. Periksa izin kamera dan koneksi browser."
            );
        }

    } finally {
        startingCamera = false;
        startBtn.disabled = !model;
    }
}

// =========================================
// 10. LOOP PREDIKSI AI
// =========================================

async function predictLoop(currentSession) {
    if (
        !running ||
        !webcam ||
        !model ||
        currentSession !== sessionId
    ) {
        return;
    }

    try {
        webcam.update();

        const results = await model.predict(
            webcam.canvas
        );

        // Abaikan hasil yang datang setelah kamera dihentikan.
        if (
            !running ||
            currentSession !== sessionId
        ) {
            return;
        }

        results.sort(
            (a, b) => b.probability - a.probability
        );

        renderPredictions(results);

    } catch (error) {
        console.error("Prediksi gagal:", error);

        stopCamera();

        setMessage(
            "Prediksi gagal. Periksa model AI dan coba muat ulang."
        );

        setStatus("Prediksi gagal", "error");

        return;
    }

    if (
        running &&
        currentSession === sessionId
    ) {
        animationId = requestAnimationFrame(
            () => predictLoop(currentSession)
        );
    }
}

// =========================================
// 11. MENAMPILKAN HASIL PREDIKSI
// =========================================

function renderPredictions(results) {
    if (!results || results.length === 0) {
        return;
    }

    lastPredictions = results.map((item) => ({
        className: item.className,
        probability: item.probability
    }));

    const best = results[0];

    const bestPercentage = Math.max(
        0,
        Math.min(100, best.probability * 100)
    );

    topExpression.textContent = best.className;

    topScore.textContent =
        bestPercentage.toFixed(1) + "%";

    ringScore.textContent =
        Math.round(bestPercentage) + "%";

    confidenceRing.style.setProperty(
        "--progress",
        (bestPercentage * 3.6) + "deg"
    );

    classCount.textContent =
        results.length + " kelas";

    lastUpdated.textContent = "Analisis langsung";

    copyBtn.disabled = false;

    predictionsBox.replaceChildren();

    results.forEach((item, index) => {
        const percentage = Math.max(
            0,
            Math.min(100, item.probability * 100)
        );

        const row = document.createElement("div");
        row.className = "score-item";

        const label = document.createElement("div");
        label.className = "score-label";

        const name = document.createElement("span");
        name.textContent =
            (index === 0 ? "✦ " : "") + item.className;

        const score = document.createElement("span");
        score.textContent =
            percentage.toFixed(1) + "%";

        label.append(name, score);

        const bar = document.createElement("div");
        bar.className = "progress";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = percentage + "%";

        bar.appendChild(fill);
        row.append(label, bar);

        predictionsBox.appendChild(row);
    });
}

// =========================================
// 12. HENTIKAN KAMERA
// =========================================

function stopCamera() {
    // Batalkan sesi saat ini, termasuk proses prediksi tertunda.
    sessionId++;

    running = false;
    startingCamera = false;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (webcam) {
        try {
            webcam.stop();
        } catch (error) {
            console.warn(
                "Kamera sudah berhenti:",
                error
            );
        }

        webcam = null;
    }

    webcamContainer.replaceChildren();
    placeholder.hidden = false;

    setCameraState(false);

    startBtn.disabled = !model;
    stopBtn.disabled = true;

    resetResults();

    if (model) {
        setStatus("Model siap", "ready");
    } else {
        setStatus("Sistem siap");
    }

    setMessage(
        "Kamera dihentikan. Tekan Mulai Kamera untuk mencoba lagi."
    );
}

// =========================================
// 13. SALIN HASIL PREDIKSI
// =========================================

copyBtn.addEventListener("click", async () => {
    if (lastPredictions.length === 0) {
        return;
    }

    const text = [
        "AI EXPRESSION LAB",
        "Ekspresi utama: " + lastPredictions[0].className,
        "Skor: " +
            (lastPredictions[0].probability * 100).toFixed(1) +
            "%",
        "",
        "Skor setiap kelas:",
        ...lastPredictions.map(
            (item) =>
                item.className + ": " +
                (item.probability * 100).toFixed(1) + "%"
        )
    ].join("\n");

    try {
        if (!navigator.clipboard) {
            throw new Error("Clipboard tidak tersedia");
        }

        await navigator.clipboard.writeText(text);

        copyBtn.lastChild.textContent = " Tersalin!";

        setTimeout(() => {
            copyBtn.lastChild.textContent = " Salin Hasil";
        }, 1800);

    } catch (error) {
        console.error("Gagal menyalin:", error);

        setMessage(
            "Gagal menyalin hasil. Pastikan aplikasi dibuka melalui HTTPS."
        );
    }
});

// =========================================
// 14. EVENT TOMBOL
// =========================================

startBtn.addEventListener(
    "click",
    startCamera
);

stopBtn.addEventListener(
    "click",
    stopCamera
);

// =========================================
// 15. KONDISI AWAL
// =========================================

function initializeApp() {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    copyBtn.disabled = true;

    setCameraState(false);
    resetResults();

    if (!window.tmImage) {
        setStatus("Pustaka AI belum tersedia", "error");

        setMessage(
            "Pustaka AI tidak berhasil dimuat. " +
            "Periksa koneksi internet dan muat ulang halaman."
        );

        setURLMessage(
            "Pustaka Teachable Machine tidak tersedia.",
            "error"
        );

        return;
    }

    setStatus("Sistem siap");

    setMessage(
        "Masukkan URL model, lalu tekan Muat Model."
    );
}

initializeApp();
