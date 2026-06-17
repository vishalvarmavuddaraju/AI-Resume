"""PDF text extraction."""
import io
import logging

from fastapi import HTTPException
from PyPDF2 import PdfReader


def extract_pdf_text(file_content: bytes) -> str:
    try:
        pdf_reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logging.error("PDF extraction error: %s", e)
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")
