import os
import re
import tempfile
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

os.environ['FLAGS_enable_pir_in_executor'] = '0'
os.environ['FLAGS_enable_pir_api'] = '0'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paddleocr_passbook")

app = FastAPI(title="KisanConnect AI Passbook Extraction", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global PaddleOCR instance (loaded on first request for fast startup)
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            try:
                _ocr_engine = PaddleOCR(use_textline_orientation=False, lang='en', enable_mkldnn=False)
            except TypeError:
                _ocr_engine = PaddleOCR(lang='en', enable_mkldnn=False)
            logger.info("PaddleOCR engine loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            _ocr_engine = False
    return _ocr_engine if _ocr_engine is not False else None


# Known Indian Banks catalog
INDIAN_BANKS = [
    "State Bank of India", "SBI", "Punjab National Bank", "PNB",
    "Bank of Baroda", "Canara Bank", "Union Bank of India", "Union Bank",
    "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
    "Indian Bank", "Bank of India", "Central Bank of India", "Central Bank",
    "Telangana Grameena Bank", "Andhra Pradesh Grameena Vikas Bank",
    "Andhra Bank", "UCO Bank", "Indian Overseas Bank", "IDBI Bank",
    "Punjab & Sind Bank", "Bank of Maharashtra", "Federal Bank",
    "South Indian Bank", "Karnataka Bank", "IndusInd Bank", "Yes Bank"
]

def clean_text(text: str) -> str:
    return text.strip().replace("\n", " ")

def extract_bank_name(lines: List[str]) -> Optional[str]:
    joined = " ".join(lines).upper()
    for bank in INDIAN_BANKS:
        bank_clean = bank.upper().replace(" ", "")
        if bank.upper() in joined or bank_clean in joined.replace(" ", ""):
            return bank
    return "State Bank of India" if "SBI" in joined else None

def extract_ifsc(lines: List[str]) -> Optional[str]:
    # 1. Search lines that explicitly mention IFSC first
    for line in lines:
        upper = line.upper()
        if "IFSC" in upper:
            m = re.search(r'IFSC[\s:\.\-CODE]*([A-Z]{4}[O0][A-Z0-9]{6})', upper)
            if m:
                raw = m.group(1)
                return raw[:4] + '0' + raw[5:]
            m_gen = re.search(r'\b([A-Z]{4}[O0][A-Z0-9]{6})\b', upper)
            if m_gen:
                raw = m_gen.group(1)
                return raw[:4] + '0' + raw[5:]

    # 2. General scan across lines, avoiding lines containing BANK or PASSBOOK
    ifsc_pattern = r'\b([A-Z]{4}0[A-Z0-9]{6})\b'
    relaxed_pattern = r'\b([A-Z]{4}[O0][A-Z0-9]{6})\b'

    for line in lines:
        upper = line.upper().replace(":", " ").replace("-", " ")
        if "BANK" in upper or "PASSBOOK" in upper or "STATEMENT" in upper:
            continue
        m = re.search(ifsc_pattern, upper)
        if m:
            return m.group(1)
        m_rel = re.search(relaxed_pattern, upper)
        if m_rel:
            raw = m_rel.group(1)
            return raw[:4] + '0' + raw[5:]
    return None

def extract_account_number(lines: List[str]) -> Optional[str]:
    # Common labels: A/C NO, ACCOUNT NO, AC NO, ACCOUNT NUMBER
    acc_label_patterns = [
        r'(?:A/C|ACC(?:OUNT)?)\s*(?:NO|NUM|NUMBER)?[\s:\.\-]+([0-9]{9,18})',
        r'\b([0-9]{9,18})\b'
    ]

    for line in lines:
        upper = line.upper()
        if any(keyword in upper for keyword in ["A/C", "ACC", "ACCOUNT"]):
            for p in acc_label_patterns:
                m = re.search(p, upper)
                if m:
                    cand = m.group(1)
                    if 9 <= len(cand) <= 18:
                        return cand

    # Fallback: scan any line containing purely 9 to 18 digits (excluding timestamps/dates)
    for line in lines:
        cleaned = re.sub(r'[^\d]', '', line)
        if 9 <= len(cleaned) <= 18:
            # Exclude phone numbers starting with 91 or 10-digit mobile if labeled as phone
            if "PHONE" in line.upper() or "MOBILE" in line.upper():
                continue
            return cleaned

    return None

def extract_account_holder(lines: List[str], bank_name: Optional[str]) -> Optional[str]:
    name_patterns = [
        r'(?:ACCOUNT\s*HOLDER\s*NAME|A/C\s*HOLDER\s*NAME|A/C\s*HOLDER|ACCOUNT\s*HOLDER|HOLDER\s*NAME|CUSTOMER\s*NAME|NAME)[\s:\.\-]+([A-Za-z\s\.\,\-]+)',
        r'\b(?:MR|MRS|MS|SHRI|SMT)[\s\.\-]+([A-Za-z\s]+)'
    ]

    for line in lines:
        upper = line.upper()
        # Skip bank header lines
        if "BANK" in upper or "PASSBOOK" in upper or "STATEMENT" in upper:
            continue
        for p in name_patterns:
            match = re.search(p, upper)
            if match:
                candidate = match.group(1).strip()
                # Clean candidate
                candidate = re.split(r'(?:A/C|ACC|ADDRESS|BRANCH|DATE|S/O|W/O|D/O|IFSC|MICR|CIF|MOBILE|PHONE)', candidate)[0].strip()
                words = candidate.split()
                if len(words) >= 1 and 3 <= len(candidate) <= 50:
                    if not any(b in candidate for b in ["BANK", "BRANCH", "PASSBOOK", "INDIA", "ACCOUNT", "HOLDER", "STATEMENT"]):
                        return candidate.title()

    # Fallback heuristic: Check lines before account number for personal name
    for line in lines:
        upper = line.upper()
        if any(prefix in upper for prefix in ["S/O", "W/O", "D/O"]):
            parts = re.split(r'\b(?:S/O|W/O|D/O)\b', upper)
            if len(parts) > 0 and len(parts[0].strip()) >= 3:
                cand = parts[0].strip().replace("NAME", "").replace(":", "").strip()
                if len(cand) >= 3 and not "BANK" in cand:
                    return cand.title()

    return None

def extract_branch(lines: List[str]) -> Optional[str]:
    branch_pattern = r'(?:BRANCH|BR)[\s:\.\-]+([A-Za-z0-9\s\,\.\-]+)'
    for line in lines:
        upper = line.upper()
        m = re.search(branch_pattern, upper)
        if m:
            cand = m.group(1).strip().rstrip(',')
            cand = re.split(r'(?:IFSC|MICR|PHONE|PIN|DATE|TEL)', cand, flags=re.IGNORECASE)[0].strip().rstrip(',')
            if len(cand) >= 3 and len(cand) <= 60:
                return cand.title()
    return None


@app.get("/api/ocr/health")
def health():
    engine = get_ocr_engine()
    return {
        "status": "healthy",
        "engine": "PaddleOCR" if engine else "PaddleOCR-Heuristic-Fallback",
        "service": "KisanConnect AI Passbook Extraction"
    }


@app.post("/api/ocr/passbook")
async def extract_passbook(
    passbook: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None)
):
    upload = passbook or file
    if not upload:
        raise HTTPException(status_code=400, detail="No passbook image file provided.")
    if upload.content_type and not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image (JPG, JPEG, PNG).")

    # Ephemeral temporary file processing: guaranteed removal
    temp_path = None
    try:
        suffix = os.path.splitext(upload.filename or "")[1] or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = tmp.name
            content = await upload.read()
            tmp.write(content)

        ocr_engine = get_ocr_engine()
        raw_lines = []
        confidences = []

        if ocr_engine:
            try:
                results = ocr_engine.predict(temp_path)
                for page in results:
                    if isinstance(page, dict):
                        texts = page.get('rec_texts', [])
                        scores = page.get('rec_scores', [])
                        raw_lines.extend([str(t) for t in texts])
                        confidences.extend([float(s) for s in scores])
                    elif isinstance(page, list):
                        for item in page:
                            if isinstance(item, list) and len(item) > 1 and isinstance(item[1], (list, tuple)):
                                raw_lines.append(str(item[1][0]))
                                confidences.append(float(item[1][1]))
            except Exception as ocr_err:
                logger.error(f"PaddleOCR detection error: {ocr_err}")

        # If OCR engine didn't extract lines (or wasn't available), perform fallback line parsing
        if not raw_lines:
            # Return clean structure with guidance
            return {
                "success": True,
                "status": "OCR Extracted",
                "data": {
                    "accountHolder": "",
                    "account_holder_name": "",
                    "bankName": "",
                    "bank_name": "",
                    "accountNumber": "",
                    "account_number": "",
                    "ifscCode": "",
                    "ifsc_code": "",
                    "branchName": "",
                    "branch_name": "",
                    "branchAddress": ""
                },
                "confidence": 0.0,
                "warning": "Some details could not be detected clearly. Please enter or correct them manually."
            }

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.85

        # Extract structured fields
        bank_name = extract_bank_name(raw_lines)
        ifsc_code = extract_ifsc(raw_lines)
        account_number = extract_account_number(raw_lines)
        account_holder = extract_account_holder(raw_lines, bank_name)
        branch_name = extract_branch(raw_lines)

        has_missing = not (bank_name and ifsc_code and account_number and account_holder)
        warning = "Some details could not be detected clearly. Please enter or correct them manually." if has_missing else None

        return {
            "success": True,
            "status": "OCR Extracted",
            "data": {
                "accountHolder": account_holder or "",
                "account_holder_name": account_holder or "",
                "bankName": bank_name or "",
                "bank_name": bank_name or "",
                "accountNumber": account_number or "",
                "account_number": account_number or "",
                "ifscCode": ifsc_code or "",
                "ifsc_code": ifsc_code or "",
                "branchName": branch_name or "",
                "branch_name": branch_name or "",
                "confidence": round(avg_confidence, 2),
                "raw_lines": raw_lines[:25]
            },
            "rawLines": raw_lines[:25],
            "confidence": round(avg_confidence, 2),
            "warning": warning
        }

    except Exception as e:
        logger.exception("Error processing passbook image")
        raise HTTPException(status_code=500, detail=f"Failed to process passbook: {str(e)}")

    finally:
        # SECURITY & PRIVACY RULE: Never store the passbook image permanently.
        # Ephemeral deletion immediately after processing.
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
