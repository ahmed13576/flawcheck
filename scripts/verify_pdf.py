#!/usr/bin/env python3
from pathlib import Path
import argparse, hashlib, re, sys
import pdfplumber
from pypdf import PdfReader

def fail(msg):
    print(f"FAIL: {msg}"); sys.exit(1)

def main():
    # Defaults resolve against this repo's own generator output (scratch/ is
    # gitignored), so the command works from a clean checkout on any OS.
    repo = Path(__file__).resolve().parent.parent
    out = repo / 'scratch' / 'report-output'
    ap=argparse.ArgumentParser()
    ap.add_argument('--pdf', default=str(out / 'flawcheck-wbt-s6-examination-report.pdf'))
    ap.add_argument('--csv', default=str(out / 'wbt-s6-canonical-cml-register.csv'))
    ap.add_argument('--tolerance', type=float, default=0.75)
    args=ap.parse_args()
    pdf=Path(args.pdf); csv=Path(args.csv)
    if not pdf.exists(): fail(f'missing PDF {pdf}')
    if not csv.exists(): fail(f'missing CSV {csv}')
    csv_bytes=csv.read_bytes()
    seal=hashlib.sha256(csv_bytes).hexdigest()
    if csv_bytes.startswith(b'\xef\xbb\xbf') or b'\r\n' in csv_bytes or not csv_bytes.endswith(b'\n') or csv_bytes.endswith(b'\n\n'):
        fail('canonical CSV byte rule failed (UTF-8 no BOM, LF, exactly one trailing newline)')
    text_parts=[]; word_count=0; out_of_bounds=[]
    with pdfplumber.open(str(pdf)) as doc:
        for page_no,page in enumerate(doc.pages,1):
            text_parts.append(page.extract_text() or '')
            words=page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
            word_count += len(words)
            for w in words:
                if w['x0'] < -args.tolerance or w['top'] < -args.tolerance or w['x1'] > page.width + args.tolerance or w['bottom'] > page.height + args.tolerance:
                    out_of_bounds.append((page_no,w.get('text'),w['x0'],w['top'],w['x1'],w['bottom'],page.width,page.height))
    if out_of_bounds:
        fail(f'word boxes outside page bounds: {out_of_bounds[:5]}')
    text='\n'.join(text_parts)
    if len(text) < 2000 or word_count < 200:
        fail('PDF does not appear to contain sufficient selectable/searchable text')
    prohibited=['RE-TIRED','INSPEC-TION','IN-CONSISTENCY','in-formational','INSUFFI-','MEASURE-','INCON-','INCONSIS-','SHORT-IN']
    found=[tok for tok in prohibited if tok in text]
    if found: fail(f'prohibited/split tokens found: {found}')
    ids=[f'{l}{i}' for l in 'ABCD' for i in range(1,11)]
    missing=[]
    dup=[]
    for suffix in ids:
        variants=[f'WBT-S6/{suffix}', f'WBT-S6 / {suffix}']
        count=sum(text.count(v) for v in variants)
        if count == 0: missing.append('WBT-S6/'+suffix)
        # IDs may appear once in Top-10 and once or more in the master row/footer extraction; require presence, not uniqueness, because report sections intentionally cross-reference top critical CMLs.
        if count > 4: dup.append(('WBT-S6/'+suffix,count))
    if missing: fail(f'missing CML IDs: {missing}')
    if dup: fail(f'unexpected duplicate CML IDs in PDF text: {dup[:10]}')
    required=['Reading-level verdicts: 4 ACCEPT · 71 RE-CHECK · 345 FAIL · total 420 readings.', 'CML-level dispositions (historical minimum governs): 0 ACCEPT · 0 RE-CHECK · 40 FAIL · total 40 CMLs.', 'Priority 1 deterministic surface indication', 'Master CML Register', 'FAIL below 19.85 mm', 'RE-CHECK 19.85 through 19.95 mm inclusive', 'ACCEPT only above 19.95 mm with no active anomaly']
    for req in required:
        if req not in text: fail(f'missing required content: {req}')
    if text.count(seal) < 2: fail('CSV seal is not printed consistently in PDF at least twice')
    meta=PdfReader(str(pdf)).metadata
    producer=str(meta.get('/Producer',''))
    creator=str(meta.get('/Creator',''))
    if 'FlawCheck Next.js app' not in producer or 'FlawCheck Next.js app' not in creator:
        fail(f'unexpected producer/creator: {producer} / {creator}')
    print(f'PASS pdf={pdf}')
    print(f'pages={len(text_parts)} word_count={word_count} text_chars={len(text)}')
    print(f'seal={seal}')
    print(f'producer={producer}')
    print(f'creator={creator}')
if __name__=='__main__': main()
