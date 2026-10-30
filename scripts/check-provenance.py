#!/usr/bin/env python3
from pathlib import Path
import hashlib, re, sys
from pypdf import PdfReader
# Repo-relative: matches the generator's default output (scratch/ is gitignored).
base = Path(__file__).resolve().parent.parent / 'scratch' / 'report-output'
pdf = base / 'flawcheck-wbt-s6-examination-report.pdf'
csv = base / 'wbt-s6-canonical-cml-register.csv'
sha_file = base / 'wbt-s6-canonical-cml-register.sha256.txt'
prov = base / 'app-route-provenance.txt'
for p in [pdf, csv, sha_file, prov]:
    if not p.exists():
        print(f'FAIL missing {p}'); sys.exit(1)
pdf_bytes = pdf.read_bytes(); csv_bytes = csv.read_bytes()
pdf_sha = hashlib.sha256(pdf_bytes).hexdigest(); csv_sha = hashlib.sha256(csv_bytes).hexdigest()
prov_text = prov.read_text(encoding='utf-8')
meta = PdfReader(str(pdf)).metadata
producer = str(meta.get('/Producer',''))
creator = str(meta.get('/Creator',''))
expect = {
    'PDF bytes': str(len(pdf_bytes)),
    'PDF SHA-256': pdf_sha,
    'PDF Producer': producer,
    'PDF Creator': creator,
    'CSV bytes': str(len(csv_bytes)),
    'CSV SHA-256': csv_sha,
}
errors=[]
for key, val in expect.items():
    if f'{key}: {val}' not in prov_text:
        errors.append(f'provenance mismatch for {key}: expected {val}')
if sha_file.read_text(encoding='utf-8').split()[0] != csv_sha:
    errors.append('CSV .sha256 sidecar does not match canonical CSV bytes')
if csv_bytes.startswith(b'\xef\xbb\xbf') or b'\r\n' in csv_bytes or not csv_bytes.endswith(b'\n') or csv_bytes.endswith(b'\n\n'):
    errors.append('CSV byte convention failed')
if errors:
    print('FAIL provenance consistency')
    print('\n'.join(errors)); sys.exit(1)
print('PASS provenance consistency')
for key, val in expect.items(): print(f'{key}: {val}')
