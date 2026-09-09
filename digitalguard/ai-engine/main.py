"""
DigitalGuard Local AI Engine — FastAPI Service

This is an INDEPENDENT process (not part of Django).
It binds to 127.0.0.1:8765 ONLY — never exposed externally.

Start with:
    cd ai-engine && uvicorn main:app --host 127.0.0.1 --port 8765

The engine provides:
- /analyze/text  — text content classification (toxicity, cyberbullying, grooming, etc.)
- /analyze/url   — URL classification (phishing, category, risk score)
- /health        — health check

PRIVACY: This service processes raw text locally.
It never sends content to external APIs.
"""

import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from analyzer import AnalysisPipeline

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(asctime)s %(message)s')
logger = logging.getLogger('digitalguard.ai_engine')

app = FastAPI(
    title='DigitalGuard Local AI Engine',
    description='Privacy-first local content analysis. Runs entirely on-device.',
    version='1.0.0',
    # Disable external docs links for privacy
    docs_url='/docs',
    redoc_url=None,
)

# CORS: only allow connections from localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://127.0.0.1:8000', 'http://localhost:8000'],
    allow_credentials=False,
    allow_methods=['POST', 'GET'],
    allow_headers=['Content-Type'],
)

# Initialize the analysis pipeline at startup
pipeline = AnalysisPipeline()


class TextAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description='Text to analyze')
    context: Optional[str] = Field(default='webpage', description='Context: webpage, chat, comment')


class URLAnalysisRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048, description='URL to classify')


class AnalysisResponse(BaseModel):
    category: str
    risk_score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    recommended_action: str  # ALLOW | WARN | BLUR | BLOCK
    inference_mode: str       # REAL | MOCK
    indicators: list = []
    sub_scores: dict = {}


@app.get('/health')
def health():
    """Health check — returns engine status and inference mode."""
    return {
        'status': 'ok',
        'inference_mode': pipeline.inference_mode,
        'model_loaded': pipeline.model_loaded,
    }


@app.post('/analyze/text', response_model=AnalysisResponse)
def analyze_text(request: TextAnalysisRequest):
    """
    Analyze text content for harmful patterns.
    Returns risk classification and recommended enforcement action.
    """
    logger.debug('Analyzing text, length=%d, context=%s', len(request.text), request.context)
    try:
        result = pipeline.analyze_text(request.text, context=request.context)
        return result
    except Exception as e:
        logger.error('Text analysis error: %s', str(e))
        raise HTTPException(status_code=500, detail=f'Analysis failed: {str(e)}')


@app.post('/analyze/url', response_model=AnalysisResponse)
def analyze_url(request: URLAnalysisRequest):
    """
    Classify a URL for safety risk.
    Uses heuristic analysis + local blocklist.
    """
    logger.debug('Analyzing URL: %s', request.url[:100])
    try:
        result = pipeline.analyze_url(request.url)
        return result
    except Exception as e:
        logger.error('URL analysis error: %s', str(e))
        raise HTTPException(status_code=500, detail=f'URL analysis failed: {str(e)}')


if __name__ == '__main__':
    import uvicorn
    logger.info('Starting DigitalGuard AI Engine on 127.0.0.1:8765')
    logger.info('Inference mode: %s', pipeline.inference_mode)
    if pipeline.inference_mode == 'MOCK':
        logger.warning(
            'MOCK INFERENCE ACTIVE — This is a development heuristic model. '
            'Install a real ONNX model (see docs/ai-engine.md) for production use.'
        )
    uvicorn.run(app, host='127.0.0.1', port=8765, log_level='info')
