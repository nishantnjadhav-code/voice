/* ==========================================================
   AGRISENSE AI — FRONTEND APPLICATION
   ----------------------------------------------------------
   Features:
   - English / Marathi / Hindi
   - Voice input
   - Voice output
   - Gemini backend connection
   - ThingSpeak live farm data
   - 30-day local history
   - Search history
   - Delete individual history items
   - Clear history
   - Quick questions
   - Mobile responsive UI
========================================================== */


/* ==========================================================
   CONFIGURATION
========================================================== */

const API_BASE_URL = "http://localhost:8000";

const HISTORY_KEY = "agrisense_ai_history_v3";

const HISTORY_DAYS = 30;


/* ==========================================================
   APPLICATION STATE
========================================================== */

let currentLanguage = "English";

let recognition = null;

let recognitionSupported = true;

let lastAnswer = "";

let lastAnswerLanguage = "English";

let isListening = false;

let isAsking = false;


/* ==========================================================
   DOM HELPERS
========================================================== */

const $ = (id) => document.getElementById(id);


/* ==========================================================
   DOM ELEMENTS
========================================================== */

const connectionStatus =
    $("connectionStatus");

const glowButton =
    $("glowButton");

const questionInput =
    $("questionInput");

const askButton =
    $("askButton");

const micButton =
    $("micButton");

const micText =
    $("micText");

const statusText =
    $("statusText");

const answerEmpty =
    $("answerEmpty");

const answerBody =
    $("answerBody");

const answerSource =
    $("answerSource");

const speakButton =
    $("speakButton");

const stopButton =
    $("stopButton");

const sensorStatus =
    $("sensorStatus");

const soilMoisture =
    $("soilMoisture");

const temperature =
    $("temperature");

const humidity =
    $("humidity");

const airQuality =
    $("airQuality");

const historySearch =
    $("historySearch");

const historyList =
    $("historyList");

const emptyHistory =
    $("emptyHistory");

const clearHistoryButton =
    $("clearHistoryButton");

const monthCount =
    $("monthCount");

const marathiCount =
    $("marathiCount");

const hindiCount =
    $("hindiCount");

const englishCount =
    $("englishCount");


/* ==========================================================
   LANGUAGE CONFIGURATION
========================================================== */

const LANGUAGE_CONFIG = {

    English: {
        recognition: "en-IN",
        speech: "en-IN",

        placeholder:
            "Type your farming question here...",

        listening:
            "LISTENING",

        thinking:
            "THINKING",

        ready:
            "TAP TO ASK",

        listeningDescription:
            "Speak naturally. AgriSense will listen.",

        thinkingDescription:
            "AgriSense is preparing your advice...",

        readyDescription:
            "Speak naturally. AgriSense will listen.",

        connection:
            "ONLINE",

        offline:
            "OFFLINE"
    },


    Marathi: {
        recognition: "mr-IN",
        speech: "mr-IN",

        placeholder:
            "तुमचा शेतीचा प्रश्न येथे लिहा...",

        listening:
            "ऐकत आहे",

        thinking:
            "विचार करत आहे",

        ready:
            "विचारा",

        listeningDescription:
            "नैसर्गिकपणे बोला. AgriSense ऐकत आहे.",

        thinkingDescription:
            "AgriSense तुमच्यासाठी सल्ला तयार करत आहे...",

        readyDescription:
            "नैसर्गिकपणे बोला. AgriSense ऐकत आहे.",

        connection:
            "ONLINE",

        offline:
            "OFFLINE"
    },


    Hindi: {
        recognition: "hi-IN",
        speech: "hi-IN",

        placeholder:
            "अपना खेती का सवाल यहाँ लिखें...",

        listening:
            "सुन रहा है",

        thinking:
            "सोच रहा है",

        ready:
            "पूछें",

        listeningDescription:
            "स्वाभाविक रूप से बोलें। AgriSense सुन रहा है.",

        thinkingDescription:
            "AgriSense आपके लिए सलाह तैयार कर रहा है...",

        readyDescription:
            "स्वाभाविक रूप से बोलें। AgriSense सुन रहा है.",

        connection:
            "ONLINE",

        offline:
            "OFFLINE"
    }

};


/* ==========================================================
   HISTORY HELPERS
========================================================== */


/**
 * Get history from localStorage.
 */
function getHistory() {

    try {

        const raw =
            localStorage.getItem(
                HISTORY_KEY
            );

        if (!raw) {

            return [];

        }

        const parsed =
            JSON.parse(raw);

        if (!Array.isArray(parsed)) {

            return [];

        }

        return parsed;

    } catch (error) {

        console.error(
            "History read error:",
            error
        );

        return [];

    }
}


/**
 * Save history.
 */
function saveHistory(history) {

    try {

        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history)
        );

    } catch (error) {

        console.error(
            "History save error:",
            error
        );

    }
}


/**
 * Remove history older than 30 days.
 */
function cleanOldHistory() {

    const history =
        getHistory();

    const cutoff =
        Date.now() -
        (
            HISTORY_DAYS *
            24 *
            60 *
            60 *
            1000
        );


    const cleaned =
        history.filter(item => {

            const timestamp =
                new Date(
                    item.timestamp
                ).getTime();

            return (
                !Number.isNaN(timestamp) &&
                timestamp >= cutoff
            );

        });


    saveHistory(cleaned);

    return cleaned;
}


/**
 * Add question to history.
 */
function addHistoryItem(
    question,
    answer,
    language,
    source
) {

    const history =
        cleanOldHistory();


    const item = {

        id:
            `${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}`,

        question:
            question,

        answer:
            answer,

        language:
            language,

        source:
            source || "AI Knowledge",

        timestamp:
            new Date().toISOString()

    };


    history.unshift(item);


    saveHistory(history);


    renderHistory();

}


/* ==========================================================
   DATE FORMATTING
========================================================== */

function formatDate(timestamp) {

    try {

        const date =
            new Date(timestamp);

        return date.toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch {

        return "";

    }

}


/* ==========================================================
   HISTORY RENDERING
========================================================== */

function renderHistory() {

    const history =
        cleanOldHistory();


    const searchTerm =
        (
            historySearch?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const filtered =
        history.filter(item => {

            if (!searchTerm) {

                return true;

            }


            const combined = (

                `${item.question || ""} ` +

                `${item.answer || ""} ` +

                `${item.language || ""}`

            ).toLowerCase();


            return combined.includes(
                searchTerm
            );

        });


    if (historyList) {

        historyList.innerHTML = "";

    }


    if (emptyHistory) {

        emptyHistory.style.display =
            filtered.length > 0
                ? "none"
                : "block";

    }


    filtered.forEach(item => {

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "history-item";


        /* --------------------------------------------------
           TOP
        -------------------------------------------------- */

        const top =
            document.createElement(
                "div"
            );

        top.className =
            "history-top";


        /* --------------------------------------------------
           QUESTION
        -------------------------------------------------- */

        const question =
            document.createElement(
                "div"
            );

        question.className =
            "history-question";


        question.textContent =
            `👨‍🌾 ${item.question}`;


        /* --------------------------------------------------
           DELETE BUTTON
        -------------------------------------------------- */

        const deleteButton =
            document.createElement(
                "button"
            );

        deleteButton.className =
            "delete-history-button";


        deleteButton.textContent =
            "DELETE";


        deleteButton.setAttribute(
            "aria-label",
            "Delete history item"
        );


        deleteButton.addEventListener(
            "click",
            () => {

                deleteHistoryItem(
                    item.id
                );

            }
        );


        top.appendChild(
            question
        );

        top.appendChild(
            deleteButton
        );


        /* --------------------------------------------------
           ANSWER
        -------------------------------------------------- */

        const answer =
            document.createElement(
                "div"
            );

        answer.className =
            "history-answer";


        answer.textContent =
            `✦ ${item.answer}`;


        /* --------------------------------------------------
           META
        -------------------------------------------------- */

        const meta =
            document.createElement(
                "div"
            );

        meta.className =
            "history-meta";


        addHistoryBadge(
            meta,
            item.language
        );


        addHistoryBadge(
            meta,
            item.source ||
            "AI Knowledge"
        );


        addHistoryBadge(
            meta,
            formatDate(
                item.timestamp
            )
        );


        article.appendChild(
            top
        );

        article.appendChild(
            answer
        );

        article.appendChild(
            meta
        );


        historyList.appendChild(
            article
        );

    });


    updateStatistics(
        history
    );

}


/**
 * Add badge.
 */
function addHistoryBadge(
    parent,
    text
) {

    const badge =
        document.createElement(
            "span"
        );

    badge.className =
        "history-badge";

    badge.textContent =
        text || "";

    parent.appendChild(
        badge
    );

}


/* ==========================================================
   DELETE SINGLE HISTORY ITEM
========================================================== */

function deleteHistoryItem(id) {

    const history =
        getHistory();


    const updated =
        history.filter(
            item =>
                item.id !== id
        );


    saveHistory(
        updated
    );


    renderHistory();

}


/* ==========================================================
   CLEAR ALL HISTORY
========================================================== */

function clearAllHistory() {

    const history =
        getHistory();


    if (!history.length) {

        return;

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete all your questions?"
        );


    if (!confirmed) {

        return;

    }


    localStorage.removeItem(
        HISTORY_KEY
    );


    renderHistory();

}


/* ==========================================================
   STATISTICS
========================================================== */

function updateStatistics(
    history
) {

    const now =
        new Date();


    const monthly =
        history.filter(item => {

            const date =
                new Date(
                    item.timestamp
                );


            return (

                date.getMonth() ===
                    now.getMonth()

                &&

                date.getFullYear() ===
                    now.getFullYear()

            );

        });


    const marathi =
        monthly.filter(
            item =>
                item.language ===
                "Marathi"
        ).length;


    const hindi =
        monthly.filter(
            item =>
                item.language ===
                "Hindi"
        ).length;


    const english =
        monthly.filter(
            item =>
                item.language ===
                "English"
        ).length;


    if (monthCount) {

        monthCount.textContent =
            monthly.length;

    }


    if (marathiCount) {

        marathiCount.textContent =
            marathi;

    }


    if (hindiCount) {

        hindiCount.textContent =
            hindi;

    }


    if (englishCount) {

        englishCount.textContent =
            english;

    }

}


/* ==========================================================
   LANGUAGE SWITCHING
========================================================== */

function setLanguage(
    language
) {

    if (
        !LANGUAGE_CONFIG[
            language
        ]
    ) {

        language =
            "English";

    }


    currentLanguage =
        language;


    const config =
        LANGUAGE_CONFIG[
            currentLanguage
        ];


    /* ------------------------------------------------------
       BUTTON ACTIVE STATE
    ------------------------------------------------------ */

    document
        .querySelectorAll(
            ".language-button"
        )
        .forEach(button => {

            const isActive =
                button.dataset.language ===
                currentLanguage;


            button.classList.toggle(
                "active",
                isActive
            );

        });


    /* ------------------------------------------------------
       INPUT PLACEHOLDER
    ------------------------------------------------------ */

    if (questionInput) {

        questionInput.placeholder =
            config.placeholder;

    }


    /* ------------------------------------------------------
       VOICE STATUS
    ------------------------------------------------------ */

    if (
        !isListening &&
        !isAsking
    ) {

        if (micText) {

            micText.textContent =
                config.ready;

        }


        if (statusText) {

            statusText.textContent =
                config.readyDescription;

        }

    }


    /* ------------------------------------------------------
       UPDATE SPEECH RECOGNITION LANGUAGE
    ------------------------------------------------------ */

    if (recognition) {

        recognition.lang =
            config.recognition;

    }

}


/* ==========================================================
   SPEECH RECOGNITION SETUP
========================================================== */

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported =
            false;


        if (micButton) {

            micButton.disabled =
                true;

            micButton.style.opacity =
                "0.45";

            micButton.style.cursor =
                "not-allowed";

        }


        if (statusText) {

            statusText.textContent =
                "Voice recognition is not supported. Please type your question.";

        }


        return;

    }


    recognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    recognition.continuous =
        false;


    recognition.interimResults =
        false;


    recognition.maxAlternatives =
        1;


    recognition.lang =
        LANGUAGE_CONFIG[
            currentLanguage
        ].recognition;


    /* ------------------------------------------------------
       START
    ------------------------------------------------------ */

    recognition.onstart =
        () => {

            isListening =
                true;


            if (micButton) {

                micButton.classList.add(
                    "listening"
                );

            }


            if (micText) {

                micText.textContent =
                    LANGUAGE_CONFIG[
                        currentLanguage
                    ].listening;

            }


            if (statusText) {

                statusText.textContent =
                    LANGUAGE_CONFIG[
                        currentLanguage
                    ].listeningDescription;

            }

        };


    /* ------------------------------------------------------
       RESULT
    ------------------------------------------------------ */

    recognition.onresult =
        event => {

            try {

                const result =
                    event.results[0][0];


                const transcript =
                    result.transcript
                        .trim();


                if (!transcript) {

                    return;

                }


                if (questionInput) {

                    questionInput.value =
                        transcript;

                }


                askQuestion(
                    transcript
                );

            } catch (error) {

                console.error(
                    "Speech result error:",
                    error
                );

            }

        };


    /* ------------------------------------------------------
       ERROR
    ------------------------------------------------------ */

    recognition.onerror =
        event => {

            console.error(
                "Speech recognition error:",
                event.error
            );


            isListening =
                false;


            if (micButton) {

                micButton.classList.remove(
                    "listening"
                );

            }


            if (micText) {

                micText.textContent =
                    LANGUAGE_CONFIG[
                        currentLanguage
                    ].ready;

            }


            if (event.error === "not-allowed") {

                if (statusText) {

                    statusText.textContent =
                        "Microphone permission was denied. Please allow microphone access.";

                }

                return;

            }


            if (event.error === "no-speech") {

                if (statusText) {

                    statusText.textContent =
                        "No speech detected. Please try again.";

                }

                return;

            }


            if (statusText) {

                statusText.textContent =
                    "Voice recognition failed. Please try again.";

            }

        };


    /* ------------------------------------------------------
       END
    ------------------------------------------------------ */

    recognition.onend =
        () => {

            isListening =
                false;


            if (micButton) {

                micButton.classList.remove(
                    "listening"
                );

            }


            if (!isAsking) {

                if (micText) {

                    micText.textContent =
                        LANGUAGE_CONFIG[
                            currentLanguage
                        ].ready;

                }

            }

        };

}


/* ==========================================================
   START VOICE RECOGNITION
========================================================== */

function startListening() {

    if (
        !recognitionSupported ||
        !recognition
    ) {

        return;

    }


    if (isListening) {

        try {

            recognition.stop();

        } catch {

            // Ignore stop errors.

        }

        return;

    }


    if (isAsking) {

        return;

    }


    try {

        recognition.lang =
            LANGUAGE_CONFIG[
                currentLanguage
            ].recognition;


        recognition.start();

    } catch (error) {

        console.error(
            "Could not start recognition:",
            error
        );

    }

}


/* ==========================================================
   API HEALTH CHECK
========================================================== */

async function checkBackendHealth() {

    if (!connectionStatus) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/health`,
                {
                    method: "GET",

                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Backend unavailable"
            );

        }


        const data =
            await response.json();


        connectionStatus.innerHTML = `

            <span class="connection-dot"></span>

            <span>
                ${data.status === "ok"
                    ? "ONLINE"
                    : "OFFLINE"}
            </span>

        `;

    } catch (error) {

        console.warn(
            "Backend health check failed:",
            error
        );


        connectionStatus.innerHTML = `

            <span
                class="connection-dot"
                style="
                    background:#ff7777;
                    box-shadow:
                        0 0 10px #ff7777;
                "
            ></span>

            <span>
                OFFLINE
            </span>

        `;

    }

}


/* ==========================================================
   LIVE SENSOR DATA
========================================================== */

async function loadSensorData() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/sensors`,
                {
                    method: "GET",

                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Sensor API unavailable"
            );

        }


        const data =
            await response.json();


        /* --------------------------------------------------
           NO DATA
        -------------------------------------------------- */

        if (
            !data ||
            !data.available
        ) {

            setSensorOffline();

            return;

        }


        /* --------------------------------------------------
           LIVE STATUS
        -------------------------------------------------- */

        if (sensorStatus) {

            sensorStatus.textContent =
                "● LIVE";

            sensorStatus.style.color =
                "var(--green)";

        }


        /* --------------------------------------------------
           SOIL MOISTURE
        -------------------------------------------------- */

        if (soilMoisture) {

            soilMoisture.textContent =
                formatSensorValue(
                    data.soil_moisture,
                    ""
                );

        }


        /* --------------------------------------------------
           TEMPERATURE
        -------------------------------------------------- */

        if (temperature) {

            temperature.textContent =
                formatSensorValue(
                    data.temperature,
                    "°"
                );

        }


        /* --------------------------------------------------
           HUMIDITY
        -------------------------------------------------- */

        if (humidity) {

            humidity.textContent =
                formatSensorValue(
                    data.humidity,
                    "%"
                );

        }


        /* --------------------------------------------------
           AIR QUALITY
        -------------------------------------------------- */

        if (airQuality) {

            airQuality.textContent =
                formatSensorValue(
                    data.air_quality,
                    ""
                );

        }

    } catch (error) {

        console.warn(
            "Sensor loading failed:",
            error
        );


        setSensorOffline();

    }

}


/* ==========================================================
   SENSOR OFFLINE STATE
========================================================== */

function setSensorOffline() {

    if (sensorStatus) {

        sensorStatus.textContent =
            "● OFFLINE";

        sensorStatus.style.color =
            "#d88a8a";

    }


    if (soilMoisture) {

        soilMoisture.textContent =
            "—";

    }


    if (temperature) {

        temperature.textContent =
            "—";

    }


    if (humidity) {

        humidity.textContent =
            "—";

    }


    if (airQuality) {

        airQuality.textContent =
            "—";

    }

}


/* ==========================================================
   SENSOR VALUE FORMATTER
========================================================== */

function formatSensorValue(
    value,
    suffix = ""
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    const numeric =
        Number(value);


    if (
        !Number.isNaN(numeric)
    ) {

        return (
            Number.isInteger(numeric)
                ? numeric
                : numeric.toFixed(1)
        ) + suffix;

    }


    return String(value) + suffix;

}


/* ==========================================================
   ASK AGRISENSE
========================================================== */

async function askQuestion(
    question
) {

    if (isAsking) {

        return;

    }


    question =
        String(
            question || ""
        ).trim();


    if (!question) {

        if (questionInput) {

            questionInput.focus();

        }

        return;

    }


    isAsking =
        true;


    /* ------------------------------------------------------
       UI: THINKING
    ------------------------------------------------------ */

    setThinkingState();


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/ask`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            question:
                                question,

                            language:
                                currentLanguage

                        })

                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            data = null;

        }


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Ask API failed"
            );

        }


        const answer =
            data?.answer ||
            getFallbackErrorMessage();


        const source =
            data?.source ||
            "AI Knowledge";


        const liveDataUsed =
            Boolean(
                data?.live_data_used
            );


        /* --------------------------------------------------
           SAVE LAST ANSWER
        -------------------------------------------------- */

        lastAnswer =
            answer;

        lastAnswerLanguage =
            currentLanguage;


        /* --------------------------------------------------
           SHOW ANSWER
        -------------------------------------------------- */

        showAnswer(
            answer,
            source,
            liveDataUsed
        );


        /* --------------------------------------------------
           SAVE HISTORY
        -------------------------------------------------- */

        addHistoryItem(
            question,
            answer,
            currentLanguage,
            source
        );


        /* --------------------------------------------------
           OPTIONAL AUTO SPEAK
        -------------------------------------------------- */

        speakAnswer(
            answer,
            currentLanguage
        );


    } catch (error) {

        console.error(
            "AgriSense request failed:",
            error
        );


        showRequestError();

    } finally {

        isAsking =
            false;


        setReadyState();

    }

}


/* ==========================================================
   THINKING STATE
========================================================== */

function setThinkingState() {

    if (micText) {

        micText.textContent =
            LANGUAGE_CONFIG[
                currentLanguage
            ].thinking;

    }


    if (statusText) {

        statusText.textContent =
            LANGUAGE_CONFIG[
                currentLanguage
            ].thinkingDescription;

    }


    if (micButton) {

        micButton.disabled =
            true;

        micButton.style.opacity =
            "0.75";

    }


    if (askButton) {

        askButton.disabled =
            true;

        askButton.style.opacity =
            "0.65";

    }

}


/* ==========================================================
   READY STATE
========================================================== */

function setReadyState() {

    if (micButton) {

        micButton.disabled =
            false;

        micButton.style.opacity =
            "1";

    }


    if (askButton) {

        askButton.disabled =
            false;

        askButton.style.opacity =
            "1";

    }


    if (!isListening) {

        if (micText) {

            micText.textContent =
                LANGUAGE_CONFIG[
                    currentLanguage
                ].ready;

        }

        if (statusText) {

            statusText.textContent =
                LANGUAGE_CONFIG[
                    currentLanguage
                ].readyDescription;

        }

    }

}


/* ==========================================================
   SHOW ANSWER
========================================================== */

function showAnswer(
    answer,
    source,
    liveDataUsed
) {

    if (answerEmpty) {

        answerEmpty.hidden =
            true;

    }


    if (answerBody) {

        answerBody.hidden =
            false;

        answerBody.textContent =
            answer;

        /* Trigger CSS animation again */

        answerBody.style.animation =
            "none";

        void answerBody.offsetWidth;

        answerBody.style.animation =
            "";

    }


    if (answerSource) {

        if (liveDataUsed) {

            answerSource.textContent =
                "🟢 LIVE FARM DATA";

        } else if (
            source ===
            "Manual Answer"
        ) {

            answerSource.textContent =
                "⚠ MANUAL ANSWER";

        } else {

            answerSource.textContent =
                "🧠 AI KNOWLEDGE";

        }

    }

}


/* ==========================================================
   REQUEST ERROR
========================================================== */

function showRequestError() {

    const messages = {

        English:
            "Sorry, I couldn't connect to AgriSense right now. Please make sure the backend is running.",

        Marathi:
            "क्षमस्व, AgriSense शी सध्या कनेक्ट होता आले नाही. कृपया backend सुरू आहे का ते तपासा.",

        Hindi:
            "क्षमा करें, AgriSense से अभी कनेक्ट नहीं हो सका। कृपया backend चल रहा है या नहीं जांचें."
    };


    const message =
        messages[
            currentLanguage
        ] ||
        messages.English;


    showAnswer(
        message,
        "Manual Answer",
        false
    );


    if (statusText) {

        statusText.textContent =
            currentLanguage === "Marathi"
                ? "कृपया backend तपासा."
                : currentLanguage === "Hindi"
                    ? "कृपया backend जांचें."
                    : "Please check that the backend is running.";

    }

}


/* ==========================================================
   FALLBACK ERROR MESSAGE
========================================================== */

function getFallbackErrorMessage() {

    const messages = {

        English:
            "Sorry, I couldn't process your question right now. Please try again.",

        Marathi:
            "क्षमस्व, तुमचा प्रश्न आत्ता प्रक्रिया करता आला नाही. कृपया पुन्हा प्रयत्न करा.",

        Hindi:
            "क्षमा करें, आपका प्रश्न अभी संसाधित नहीं हो सका। कृपया फिर से प्रयास करें."
    };


    return (
        messages[
            currentLanguage
        ] ||
        messages.English
    );

}


/* ==========================================================
   SPEECH SYNTHESIS
========================================================== */

function speakAnswer(
    text,
    language
) {

    if (
        !text ||
        !("speechSynthesis" in window)
    ) {

        return;

    }


    try {

        window.speechSynthesis.cancel();


        const utterance =
            new SpeechSynthesisUtterance(
                text
            );


        const config =
            LANGUAGE_CONFIG[
                language
            ] ||
            LANGUAGE_CONFIG.English;


        utterance.lang =
            config.speech;


        utterance.rate =
            0.90;


        utterance.pitch =
            1.0;


        utterance.volume =
            1.0;


        /* --------------------------------------------------
           TRY TO FIND A LANGUAGE-SPECIFIC VOICE
        -------------------------------------------------- */

        const voices =
            window.speechSynthesis
                .getVoices();


        const languageCode =
            config.speech
                .split("-")[0]
                .toLowerCase();


        const matchingVoice =
            voices.find(
                voice => {

                    const voiceLanguage =
                        (
                            voice.lang ||
                            ""
                        )
                        .toLowerCase();


                    return voiceLanguage
                        .startsWith(
                            languageCode
                        );

                }
            );


        if (matchingVoice) {

            utterance.voice =
                matchingVoice;

        }


        utterance.onstart =
            () => {

                if (micText) {

                    micText.textContent =
                        "🔊 SPEAKING";

                }

            };


        utterance.onend =
            () => {

                if (!isListening && !isAsking) {

                    if (micText) {

                        micText.textContent =
                            LANGUAGE_CONFIG[
                                currentLanguage
                            ].ready;

                    }

                }

            };


        utterance.onerror =
            error => {

                console.warn(
                    "Speech synthesis error:",
                    error
                );

                setReadyState();

            };


        window.speechSynthesis
            .speak(
                utterance
            );

    } catch (error) {

        console.error(
            "Speech synthesis failed:",
            error
        );

    }

}


/* ==========================================================
   STOP SPEAKING
========================================================== */

function stopSpeaking() {

    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.cancel();

    }


    setReadyState();

}


/* ==========================================================
   LANGUAGE BUTTON EVENTS
========================================================== */

function setupLanguageButtons() {

    document
        .querySelectorAll(
            ".language-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const language =
                        button.dataset.language;


                    if (!language) {

                        return;

                    }


                    setLanguage(
                        language
                    );

                }
            );

        });

}


/* ==========================================================
   QUICK QUESTION EVENTS
========================================================== */

function setupQuickQuestions() {

    document
        .querySelectorAll(
            ".quick-question"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const question =
                        button.dataset.question;


                    if (!question) {

                        return;

                    }


                    if (questionInput) {

                        questionInput.value =
                            question;

                        questionInput.focus();

                    }


                    askQuestion(
                        question
                    );

                }
            );

        });

}


/* ==========================================================
   ENTER KEY
========================================================== */

function setupQuestionInput() {

    if (!questionInput) {

        return;

    }


    questionInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                askQuestion(
                    questionInput.value
                );

            }

        }
    );

}


/* ==========================================================
   ASK BUTTON
========================================================== */

function setupAskButton() {

    if (!askButton) {

        return;

    }


    askButton.addEventListener(
        "click",
        () => {

            askQuestion(
                questionInput?.value ||
                ""
            );

        }
    );

}


/* ==========================================================
   MICROPHONE BUTTON
========================================================== */

function setupMicrophoneButton() {

    if (!micButton) {

        return;

    }


    micButton.addEventListener(
        "click",
        () => {

            startListening();

        }
    );

}


/* ==========================================================
   SPEAK BUTTON
========================================================== */

function setupSpeakButton() {

    if (!speakButton) {

        return;

    }


    speakButton.addEventListener(
        "click",
        () => {

            if (!lastAnswer) {

                return;

            }


            speakAnswer(
                lastAnswer,
                lastAnswerLanguage
            );

        }
    );

}


/* ==========================================================
   STOP BUTTON
========================================================== */

function setupStopButton() {

    if (!stopButton) {

        return;

    }


    stopButton.addEventListener(
        "click",
        () => {

            stopSpeaking();

        }
    );

}


/* ==========================================================
   HISTORY SEARCH
========================================================== */

function setupHistorySearch() {

    if (!historySearch) {

        return;

    }


    historySearch.addEventListener(
        "input",
        () => {

            renderHistory();

        }
    );

}


/* ==========================================================
   CLEAR HISTORY
========================================================== */

function setupClearHistory() {

    if (!clearHistoryButton) {

        return;

    }


    clearHistoryButton.addEventListener(
        "click",
        () => {

            clearAllHistory();

        }
    );

}


/* ==========================================================
   GLOW BUTTON
========================================================== */

function setupGlowButton() {

    if (!glowButton) {

        return;

    }


    glowButton.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "high-glow"
            );


            const enabled =
                document.body.classList.contains(
                    "high-glow"
                );


            localStorage.setItem(
                "agrisense_high_glow",
                enabled
                    ? "true"
                    : "false"
            );

        }
    );

}


/* ==========================================================
   RESTORE GLOW SETTING
========================================================== */

function restoreGlowSetting() {

    const saved =
        localStorage.getItem(
            "agrisense_high_glow"
        );


    if (
        saved === "true"
    ) {

        document.body.classList.add(
            "high-glow"
        );

    }

}


/* ==========================================================
   SPEECH VOICE LOADING
========================================================== */

function setupSpeechVoices() {

    if (
        !("speechSynthesis" in window)
    ) {

        return;

    }


    /*
     * Some browsers load voices asynchronously.
     * Calling getVoices() here and onvoiceschanged
     * ensures the voice list becomes available.
     */

    window.speechSynthesis
        .getVoices();


    window.speechSynthesis.onvoiceschanged =
        () => {

            window.speechSynthesis
                .getVoices();

        };

}


/* ==========================================================
   INITIAL SENSOR LOAD
========================================================== */

function startSensorPolling() {

    loadSensorData();


    /*
     * Refresh live farm data every minute.
     */

    window.setInterval(
        () => {

            loadSensorData();

        },
        60 * 1000
    );

}


/* ==========================================================
   INITIAL BACKEND HEALTH POLLING
========================================================== */

function startHealthPolling() {

    checkBackendHealth();


    /*
     * Check backend every minute.
     */

    window.setInterval(
        () => {

            checkBackendHealth();

        },
        60 * 1000
    );

}


/* ==========================================================
   INITIALIZE APPLICATION
========================================================== */

function initializeAgriSense() {

    console.log(
        "🌾 AgriSense AI initializing..."
    );


    /* ------------------------------------------------------
       Language
    ------------------------------------------------------ */

    setLanguage(
        "English"
    );


    /* ------------------------------------------------------
       History
    ------------------------------------------------------ */

    cleanOldHistory();

    renderHistory();


    /* ------------------------------------------------------
       Speech
    ------------------------------------------------------ */

    setupSpeechRecognition();

    setupSpeechVoices();


    /* ------------------------------------------------------
       UI EVENTS
    ------------------------------------------------------ */

    setupLanguageButtons();

    setupQuickQuestions();

    setupQuestionInput();

    setupAskButton();

    setupMicrophoneButton();

    setupSpeakButton();

    setupStopButton();

    setupHistorySearch();

    setupClearHistory();

    setupGlowButton();


    /* ------------------------------------------------------
       Restore settings
    ------------------------------------------------------ */

    restoreGlowSetting();


    /* ------------------------------------------------------
       Backend
    ------------------------------------------------------ */

    startHealthPolling();


    /* ------------------------------------------------------
       Sensors
    ------------------------------------------------------ */

    startSensorPolling();


    console.log(
        "🌱 AgriSense AI ready."
    );

}


/* ==========================================================
   START APPLICATION
========================================================== */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAgriSense
    );

} else {

    initializeAgriSense();

}