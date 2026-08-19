import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ============================================================
# PATHS & ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

load_dotenv(BASE_DIR / ".env")


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AgriSense AI",
    description="AI Voice Assistant for Farmers",
    version="2.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY",
    ""
).strip()

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash"
).strip()

THINGSPEAK_CHANNEL_ID = os.getenv(
    "THINGSPEAK_CHANNEL_ID",
    ""
).strip()

THINGSPEAK_READ_API_KEY = os.getenv(
    "THINGSPEAK_READ_API_KEY",
    ""
).strip()


# ============================================================
# THINGSPEAK FIELD MAPPING
# ============================================================
#
# Change these numbers if your ThingSpeak fields are different.
#
# field1 = soil moisture
# field2 = temperature
# field3 = humidity
# field4 = air quality
# ============================================================

THING_SPEAK_FIELDS = {
    "soil_moisture": 1,
    "temperature": 2,
    "humidity": 3,
    "air_quality": 4,
}


# ============================================================
# COMMANDS FILE
# ============================================================

COMMANDS_FILE = BASE_DIR / "commands.json"


# ============================================================
# AGRISENSE AI SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are AgriSense AI, a practical agricultural advisor
designed specifically for farmers.

============================================================
LANGUAGES
============================================================

The farmer may communicate in:

1. English
2. Marathi
3. Hindi

Always answer in the farmer's selected language.

Do not randomly switch languages.

If the selected language is Marathi, answer in Marathi.

If the selected language is Hindi, answer in Hindi.

If the selected language is English, answer in English.

============================================================
GENERAL BEHAVIOR
============================================================

Provide practical, understandable and useful agricultural
guidance.

Use simple language that a farmer can understand.

Avoid unnecessary technical terminology.

Consider, when available:

- crop
- crop variety
- crop stage
- soil
- irrigation
- weather
- location
- season
- farmer-provided information
- live farm sensor information

Give the direct answer first.

Do not begin every answer with a generic greeting.

Do not repeatedly say:
"Hello, I am AgriSense AI."

Only greet when the farmer is actually greeting you.

============================================================
DO NOT INVENT FACTS
============================================================

Never invent:

- live weather
- market prices
- sensor readings
- soil measurements
- farm measurements
- temperature
- humidity
- moisture values

If live farm data is supplied by AgriSense AI, use only the
actual values supplied to you.

Clearly distinguish live sensor data from general knowledge.

============================================================
FOLLOW-UP QUESTIONS
============================================================

If important information is missing, ask a short follow-up
question when it is necessary.

However, for simple agricultural identification questions,
provide useful general information first.

Do not stop immediately just because crop stage or soil test
information is missing.

Only request additional information when it is needed for:

- exact dosage
- exact fertilizer quantity
- exact pesticide recommendation
- location-specific advice
- disease/pest identification

============================================================
FERTILIZER RULES
============================================================

When the farmer asks about:

- fertilizer
- fertiliser
- fertilizer recommendation
- which fertilizer
- what fertilizer
- best fertilizer
- fertilizer for a crop
- fertilizer dose
- fertilizer quantity
- fertilizer application
- खत
- खत कोणते
- कोणते खत
- खताचा वापर
- खताची मात्रा
- खाद
- कौन सा खाद
- कौन सा उर्वरक
- उर्वरक

treat it as a fertilizer-specific question.

Answer directly.

If the crop is known, identify the crop immediately.

Clearly explain:

N = Nitrogen
P = Phosphorus
K = Potassium

Explain:

Nitrogen:
Supports vegetative growth, leaves and overall plant growth.

Phosphorus:
Supports root development, crop establishment, flowering and
reproductive development.

Potassium:
Supports plant strength, water regulation, stress tolerance
and crop/fruit/grain quality.

============================================================
SECONDARY NUTRIENTS
============================================================

When relevant, mention:

- Sulphur
- Calcium
- Magnesium

Only mention them when they are relevant.

============================================================
MICRONUTRIENTS
============================================================

When relevant, mention:

- Zinc
- Boron
- Iron

Do not automatically recommend every micronutrient.

============================================================
FERTILIZER APPLICATION
============================================================

When relevant, distinguish between:

1. Basal fertilizer
2. Top dressing
3. Crop-stage-specific fertilizer

Do not claim that one fertilizer is universally best.

============================================================
EXACT FERTILIZER QUANTITY
============================================================

Do not give a fixed fertilizer quantity as universally correct.

Exact quantity may depend on:

- crop
- variety
- crop stage
- soil test
- previous fertilizer use
- irrigation
- location
- local recommendation

If exact information is unavailable:

Give useful general nutrient guidance first.

Then explain what information is required for an exact
recommendation.

============================================================
PEST MANAGEMENT
============================================================

For pest-management questions, provide a complete answer.

Cover, when relevant:

1. Pest identification
2. Monitoring
3. Preventive practices
4. Cultural practices
5. Mechanical/physical control
6. Biological control
7. Chemical control when necessary
8. Safety precautions
9. Information needed for crop-specific advice

Do not immediately recommend pesticides without identifying
the crop/pest or symptoms.

If crop or pest is unknown:

First provide general IPM guidance.

Then ask for the crop name and pest/symptoms.

============================================================
DISEASE QUESTIONS
============================================================

Do not diagnose a disease with certainty from limited
information.

Explain possible causes and what the farmer should check.

If needed, request:

- crop
- symptoms
- affected plant part
- progression
- field conditions
- photograph

============================================================
IRRIGATION
============================================================

When discussing irrigation, consider:

- soil moisture
- soil type
- crop stage
- weather
- crop water requirement

Avoid recommending excessive irrigation.

If live soil-moisture data exists, use it.

============================================================
SAFETY
============================================================

Never claim that an agricultural recommendation is guaranteed.

Avoid unsafe pesticide or fertilizer instructions.

For high-risk decisions, recommend verification with a qualified
local agricultural expert.

============================================================
COMPLETE ANSWER RULE
============================================================

Always finish the answer completely.

Never stop in the middle of:

- a sentence
- bullet point
- numbered list
- heading
- recommendation
- explanation

For broad questions, provide a complete structured answer.

Do not end with an unfinished sentence.

============================================================
ANSWER STYLE
============================================================

Prefer:

- short headings
- bullet points
- clear explanations
- practical recommendations

Answer the farmer's actual question first.
"""


# ============================================================
# REQUEST MODEL
# ============================================================

class AskRequest(BaseModel):

    question: str = Field(
        ...,
        min_length=1,
        max_length=3000
    )

    language: str = Field(
        default="English"
    )


# ============================================================
# LOAD MANUAL COMMANDS
# ============================================================

def load_commands() -> Dict[str, Dict[str, str]]:

    try:

        if not COMMANDS_FILE.exists():

            print(
                "commands.json not found:",
                COMMANDS_FILE
            )

            return {
                "english": {},
                "marathi": {},
                "hindi": {}
            }

        with COMMANDS_FILE.open(
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        if not isinstance(
            data,
            dict
        ):

            print(
                "commands.json must contain a JSON object."
            )

            return {
                "english": {},
                "marathi": {},
                "hindi": {}
            }

        return data

    except Exception as error:

        print(
            "Commands file error:",
            repr(error)
        )

        return {
            "english": {},
            "marathi": {},
            "hindi": {}
        }


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(
    text: str
) -> str:

    if not text:

        return ""

    text = text.lower().strip()

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text


# ============================================================
# LANGUAGE KEY
# ============================================================

def get_language_key(
    language: str
) -> str:

    language = language.strip().lower()

    if language == "marathi":

        return "marathi"

    if language == "hindi":

        return "hindi"

    return "english"


# ============================================================
# MANUAL ANSWER MATCHING
# ============================================================
#
# IMPORTANT:
# Manual answers have PRIORITY over Gemini.
#
# Exact match first.
# Keyword match second.
# If a manual answer is found, Gemini is NOT called.
# ============================================================

def manual_fallback(
    question: str,
    language: str
) -> Optional[str]:

    commands = load_commands()

    language_key = get_language_key(
        language
    )

    language_commands = commands.get(
        language_key,
        {}
    )

    if not isinstance(
        language_commands,
        dict
    ):

        return None

    normalized_question = normalize_text(
        question
    )

    # ========================================================
    # EXACT MATCH
    # ========================================================

    for pattern, answer in language_commands.items():

        if not isinstance(
            pattern,
            str
        ):

            continue

        if (
            normalized_question ==
            normalize_text(pattern)
        ):

            return str(answer)

    # ========================================================
    # KEYWORD MATCH
    # ========================================================
    #
    # This allows small variations such as:
    #
    # "What is NPK"
    # "what is npk?"
    #
    # However, only use a manual answer when there is enough
    # keyword overlap.
    # ========================================================

    best_answer = None

    best_score = 0

    best_ratio = 0.0

    for pattern, answer in language_commands.items():

        if not isinstance(
            pattern,
            str
        ):

            continue

        normalized_pattern = normalize_text(
            pattern
        )

        pattern_words = re.findall(
            r"[\w\u0900-\u097F]+",
            normalized_pattern
        )

        pattern_words = [

            word

            for word in pattern_words

            if len(word) > 2

        ]

        if not pattern_words:

            continue

        question_words = set(
            re.findall(
                r"[\w\u0900-\u097F]+",
                normalized_question
            )
        )

        matched_words = [

            word

            for word in pattern_words

            if word in question_words

        ]

        score = len(
            matched_words
        )

        ratio = (
            score /
            len(pattern_words)
        )

        # Require enough matching keywords.
        #
        # For one-word patterns, require exact matching
        # through the exact-match section above.
        if (
            len(pattern_words) >= 2
            and score >= 2
            and ratio >= 0.50
        ):

            if (
                score > best_score
                or (
                    score == best_score
                    and ratio > best_ratio
                )
            ):

                best_score = score

                best_ratio = ratio

                best_answer = str(
                    answer
                )

    if best_answer:

        return best_answer

    return None


# ============================================================
# FERTILIZER QUESTION DETECTION
# ============================================================

def is_fertilizer_question(
    question: str
) -> bool:

    q = normalize_text(
        question
    )

    fertilizer_keywords = [

        # English
        "fertilizer",
        "fertiliser",
        "fertilizers",
        "fertilisers",
        "which fertilizer",
        "what fertilizer",
        "best fertilizer",
        "fertilizer for",
        "fertiliser for",
        "fertilizer dose",
        "fertilizer quantity",
        "fertilizer application",

        # Marathi
        "खत",
        "खताचा",
        "खताचे",
        "खतासाठी",
        "खत कोणते",
        "कोणते खत",
        "खत वापरावे",
        "खताचा वापर",
        "खताची मात्रा",
        "खताचे प्रमाण",

        # Hindi
        "खाद",
        "खाद कौन",
        "कौन सा खाद",
        "कौनसी खाद",
        "खाद का",
        "खाद की मात्रा",
        "उर्वरक",
        "उर्वरक कौन",
        "कौन सा उर्वरक"
    ]

    for keyword in fertilizer_keywords:

        if keyword in q:

            return True

    return False


# ============================================================
# LIVE DATA DETECTION
# ============================================================

def may_need_live_data(
    question: str
) -> bool:

    q = normalize_text(
        question
    )

    keywords = [

        # English
        "soil moisture",
        "moisture",
        "sensor",
        "sensors",
        "temperature",
        "humidity",
        "air quality",
        "live data",
        "farm data",
        "field data",
        "my field",
        "my farm",
        "my soil",
        "soil condition",
        "soil level",

        # Marathi
        "मातीतील ओलावा",
        "जमिनीतील ओलावा",
        "ओलावा",
        "सेन्सर",
        "तापमान",
        "आर्द्रता",
        "माझ्या शेतातील",
        "माझ्या शेतात",
        "माझ्या जमिनीत",
        "शेतातील डेटा",

        # Hindi
        "मिट्टी की नमी",
        "मिट्टी में नमी",
        "नमी",
        "सेंसर",
        "तापमान",
        "आर्द्रता",
        "मेरे खेत",
        "मेरे खेत का",
        "मेरी मिट्टी",
        "खेत का डेटा"
    ]

    for keyword in keywords:

        if keyword in q:

            return True

    return False


# ============================================================
# THINGSPEAK DATA
# ============================================================

async def get_thingspeak_data() -> Dict[str, Any]:

    if not THINGSPEAK_CHANNEL_ID:

        return {
            "available": False,
            "message": "Live farm data unavailable"
        }

    url = (
        "https://api.thingspeak.com/"
        f"channels/{THINGSPEAK_CHANNEL_ID}/feeds/last.json"
    )

    params = {}

    if THINGSPEAK_READ_API_KEY:

        params["api_key"] = (
            THINGSPEAK_READ_API_KEY
        )

    try:

        async with httpx.AsyncClient(
            timeout=8.0
        ) as client:

            response = await client.get(
                url,
                params=params
            )

            response.raise_for_status()

            payload = response.json()

        result: Dict[str, Any] = {

            "available": True,

            "updated_at":
                payload.get(
                    "created_at"
                )

        }

        # ----------------------------------------------------
        # READ THINGSPEAK FIELDS
        # ----------------------------------------------------

        for (
            name,
            field_number
        ) in THING_SPEAK_FIELDS.items():

            field_name = (
                f"field{field_number}"
            )

            raw_value = payload.get(
                field_name
            )

            if raw_value in (
                None,
                ""
            ):

                continue

            try:

                result[name] = float(
                    raw_value
                )

            except (
                ValueError,
                TypeError
            ):

                result[name] = raw_value

        return result

    except Exception as error:

        print(
            "ThingSpeak API error:",
            repr(error)
        )

        return {
            "available": False,
            "message":
                "Live farm data unavailable"
        }


# ============================================================
# GEMINI API
# ============================================================

async def ask_gemini(
    question: str,
    language: str,
    sensor_data: Optional[
        Dict[str, Any]
    ] = None
) -> Optional[str]:

    # --------------------------------------------------------
    # API KEY CHECK
    # --------------------------------------------------------

    if not GEMINI_API_KEY:

        print(
            "Gemini API error: "
            "GEMINI_API_KEY is missing."
        )

        return None

    # --------------------------------------------------------
    # LIVE SENSOR CONTEXT
    # --------------------------------------------------------

    live_context = ""

    if (
        sensor_data
        and sensor_data.get(
            "available"
        )
    ):

        safe_sensor_data = {

            key: value

            for key, value
            in sensor_data.items()

            if key not in {
                "available",
                "updated_at"
            }

        }

        live_context = (

            "\n\n"

            "LIVE FARM SENSOR DATA:\n"

            + json.dumps(
                safe_sensor_data,
                ensure_ascii=False
            )

            +

            "\n\n"

            "These are actual sensor values. "
            "Do not invent, modify or replace them."

        )

    # --------------------------------------------------------
    # FERTILIZER CONTEXT
    # --------------------------------------------------------

    fertilizer_context = ""

    if is_fertilizer_question(
        question
    ):

        fertilizer_context = """

IMPORTANT:

This is a fertilizer-related question.

Answer the fertilizer question directly.

Clearly identify:

- crop, if provided
- N — Nitrogen
- P — Phosphorus
- K — Potassium
- role of each nutrient
- relevant secondary nutrients
- relevant micronutrients
- basal/top-dressing/stage guidance where appropriate

Do not give a vague generic answer.

Do not claim that one fertilizer is universally best.

If an exact quantity depends on soil test, crop stage or
location, give useful general information first and explain
what additional information is required.
"""

    # --------------------------------------------------------
    # PROMPT
    # --------------------------------------------------------

    prompt = f"""

{SYSTEM_PROMPT}

============================================================
CURRENT QUESTION
============================================================

Selected language:
{language}

Farmer question:
{question}

{fertilizer_context}

{live_context}

============================================================
FINAL RESPONSE INSTRUCTION
============================================================

Answer directly in {language}.

Do not begin with a generic greeting unless appropriate.

Give the most useful information first.

Use headings and bullet points when useful.

Complete the entire answer.

Never end in the middle of a sentence or bullet point.

Do not invent missing facts.
"""

    # --------------------------------------------------------
    # GEMINI URL
    # --------------------------------------------------------

    url = (
        "https://generativelanguage.googleapis.com/"
        "v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )

    # --------------------------------------------------------
    # REQUEST BODY
    # --------------------------------------------------------

    request_body = {

        "contents": [

            {

                "role": "user",

                "parts": [

                    {
                        "text": prompt
                    }

                ]

            }

        ],

        "generationConfig": {

            "maxOutputTokens": 2200

        }

    }

    # --------------------------------------------------------
    # REQUEST
    # --------------------------------------------------------

    try:

        async with httpx.AsyncClient(
            timeout=35.0
        ) as client:

            response = await client.post(

                url,

                headers={

                    "x-goog-api-key":
                        GEMINI_API_KEY,

                    "Content-Type":
                        "application/json"

                },

                json=request_body

            )

            # ------------------------------------------------
            # SHOW REAL ERROR
            # ------------------------------------------------

            if not response.is_success:

                print(
                    "======================================"
                )

                print(
                    "GEMINI ERROR"
                )

                print(
                    "HTTP STATUS:",
                    response.status_code
                )

                print(
                    "RESPONSE:",
                    response.text
                )

                print(
                    "======================================"
                )

                response.raise_for_status()

            data = response.json()

        # ----------------------------------------------------
        # CANDIDATES
        # ----------------------------------------------------

        candidates = data.get(
            "candidates",
            []
        )

        if not candidates:

            print(
                "Gemini returned no candidates."
            )

            print(
                "Gemini response:",
                data
            )

            return None

        # ----------------------------------------------------
        # CONTENT
        # ----------------------------------------------------

        content = candidates[0].get(
            "content",
            {}
        )

        parts = content.get(
            "parts",
            []
        )

        text_parts = []

        for part in parts:

            text = part.get(
                "text",
                ""
            )

            if text:

                text_parts.append(
                    text
                )

        final_text = "".join(
            text_parts
        ).strip()

        if not final_text:

            print(
                "Gemini returned empty text."
            )

            print(
                "Gemini response:",
                data
            )

            return None

        return final_text

    # --------------------------------------------------------
    # HTTP ERROR
    # --------------------------------------------------------

    except httpx.HTTPStatusError as error:

        print(
            "Gemini HTTP error:",
            repr(error)
        )

        if error.response is not None:

            print(
                "Status:",
                error.response.status_code
            )

            print(
                "Body:",
                error.response.text
            )

        return None

    # --------------------------------------------------------
    # NETWORK ERROR
    # --------------------------------------------------------

    except httpx.RequestError as error:

        print(
            "Gemini network error:",
            repr(error)
        )

        return None

    # --------------------------------------------------------
    # OTHER ERROR
    # --------------------------------------------------------

    except Exception as error:

        print(
            "Gemini API error:",
            repr(error)
        )

        return None


# ============================================================
# HEALTH API
# ============================================================

@app.get("/api/health")
async def health():

    return {

        "status": "ok",

        "message":
            "AgriSense AI backend is running"

    }


# ============================================================
# SENSOR API
# ============================================================

@app.get("/api/sensors")
async def sensors():

    return await get_thingspeak_data()


# ============================================================
# ASK API
# ============================================================
#
# IMPORTANT FLOW:
#
# 1. Validate request
# 2. Check manual Q&A FIRST
# 3. If manual answer exists → return it
# 4. Otherwise → get live data if required
# 5. Send question to Gemini
# 6. Return Gemini answer
# 7. If Gemini fails → safe fallback
#
# ============================================================

@app.post("/api/ask")
async def ask(
    request: AskRequest
):

    question = request.question.strip()

    language = request.language.strip()

    # --------------------------------------------------------
    # VALIDATE LANGUAGE
    # --------------------------------------------------------

    if language not in {
        "English",
        "Marathi",
        "Hindi"
    }:

        language = "English"

    # --------------------------------------------------------
    # EMPTY QUESTION
    # --------------------------------------------------------

    if not question:

        messages = {

            "English":
                "Please enter a farming question.",

            "Marathi":
                "कृपया शेतीशी संबंधित प्रश्न विचारा.",

            "Hindi":
                "कृपया खेती से संबंधित प्रश्न पूछें."

        }

        return {

            "answer":
                messages[language],

            "source":
                "Manual Answer",

            "live_data_used":
                False

        }

    # ========================================================
    # STEP 1 — MANUAL Q&A HAS PRIORITY
    # ========================================================

    manual_answer = manual_fallback(

        question=question,

        language=language

    )

    if manual_answer:

        print(
            "======================================"
        )

        print(
            "MANUAL ANSWER SELECTED"
        )

        print(
            "Language:",
            language
        )

        print(
            "Question:",
            question
        )

        print(
            "======================================"
        )

        return {

            "answer":
                manual_answer,

            "source":
                "Manual Answer",

            "live_data_used":
                False

        }

    # ========================================================
    # STEP 2 — NO MANUAL ANSWER
    #         CHECK LIVE FARM DATA
    # ========================================================

    sensor_data = None

    if may_need_live_data(
        question
    ):

        sensor_data = (
            await get_thingspeak_data()
        )

    # ========================================================
    # STEP 3 — GEMINI
    # ========================================================

    ai_answer = await ask_gemini(

        question=question,

        language=language,

        sensor_data=sensor_data

    )

    if ai_answer:

        live_used = bool(

            sensor_data

            and sensor_data.get(
                "available"
            )

        )

        return {

            "answer":
                ai_answer,

            "source":

                (
                    "Live Farm Data"
                    if live_used
                    else
                    "AI Knowledge"
                ),

            "live_data_used":
                live_used

        }

    # ========================================================
    # STEP 4 — GEMINI FAILED
    # ========================================================

    fallback_messages = {

        "English":

            (
                "Sorry, I couldn't process your "
                "question right now. Please try again."
            ),

        "Marathi":

            (
                "क्षमस्व, तुमचा प्रश्न आत्ता "
                "प्रक्रिया करता आला नाही. "
                "कृपया पुन्हा प्रयत्न करा."
            ),

        "Hindi":

            (
                "क्षमा करें, आपका प्रश्न अभी "
                "संसाधित नहीं हो सका। "
                "कृपया फिर से प्रयास करें."
            )

    }

    return {

        "answer":
            fallback_messages[language],

        "source":
            "AI Knowledge",

        "live_data_used":
            False

    }


# ============================================================
# FRONTEND — SERVE THE UI FROM THE SAME RENDER SERVICE
# ============================================================
#
# One Render URL now serves both the frontend and backend:
#
#   /             -> frontend/index.html
#   /app.js       -> frontend/app.js
#   /style.css    -> frontend/style.css
#
# API routes remain:
#   /api/health
#   /api/sensors
#   /api/ask
#
# This mount is intentionally placed AFTER the API routes.
# ============================================================

if FRONTEND_DIR.exists():
    app.mount(
        "/",
        StaticFiles(
            directory=str(FRONTEND_DIR),
            html=True
        ),
        name="frontend"
    )
else:
    print(
        "Frontend directory not found:",
        FRONTEND_DIR
    )


# ============================================================
# LOCAL DEVELOPMENT ENTRY POINT
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(

        "app:app",

        host="0.0.0.0",

        port=8001,

        reload=True

    )