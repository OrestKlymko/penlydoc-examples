"""PenlyDoc in a Flask app: send a contract from a template, hand out embedded signing links, receive webhooks.

Run:  pip install -r requirements.txt
      PENLY_API_KEY=sk_... PENLY_WEBHOOK_SECRET=whsec_... PENLY_TEMPLATE_ID=... flask --app app run
"""
import hashlib
import hmac
import os
import time

import requests
from flask import Flask, abort, jsonify, request

PENLY = os.environ.get("PENLY_URL", "https://penlydoc.com")
KEY = os.environ["PENLY_API_KEY"]
HEADERS = {"Authorization": f"Bearer {KEY}"}

app = Flask(__name__)
contracts = {}  # your database: contract id -> PenlyDoc envelope and recipient ids
seen_events = set()


@app.post("/contracts")
def create_contract():
    body = request.get_json()
    contract_id = body["contractId"]
    r = requests.post(
        f"{PENLY}/v1/templates/{os.environ['PENLY_TEMPLATE_ID']}/envelopes",
        headers={**HEADERS, "Idempotency-Key": contract_id},  # a retry never sends the contract twice
        json={
            "send": True,
            "externalRef": contract_id,
            "roles": {
                # the customer signs inside your app, the second role signs by e-mail
                "customer": {"name": body["name"], "email": body["email"], "delivery": "EMBEDDED"},
                "company": {"name": "Your Company Ltd.", "email": "contracts@yourcompany.example"},
            },
            "data": {"Price": body["price"]},
        },
        timeout=20,
    )
    if not r.ok:
        return r.json(), 502
    envelope = r.json()
    customer = next(x for x in envelope["recipients"] if x["email"].lower() == body["email"].lower())
    contracts[contract_id] = {"envelope": envelope["id"], "recipient": customer["id"], "email": customer["email"], "status": "sent"}
    return jsonify(contracts[contract_id]), 201


@app.post("/contracts/<contract_id>/sign-link")
def sign_link(contract_id):
    row = contracts.get(contract_id)
    # check here that the logged-in user really is this signer
    if row is None:
        abort(404)
    r = requests.post(f"{PENLY}/v1/envelopes/{row['envelope']}/recipients/{row['recipient']}/signing-url",
                      headers=HEADERS, json={}, timeout=10)
    if not r.ok:
        return r.json(), 502  # e.g. 409 not_open when the contract was cancelled or has expired
    resp = jsonify(url=r.json()["url"], expiresAt=r.json()["expiresAt"])
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.post("/webhooks/penly")
def penly_webhook():
    parts = dict(p.split("=", 1) for p in request.headers.get("Penly-Signature", "").split(",") if "=" in p)
    body = request.get_data(as_text=True)
    expected = hmac.new(os.environ["PENLY_WEBHOOK_SECRET"].encode(), f"{parts.get('t')}.{body}".encode(), hashlib.sha256).hexdigest()
    if abs(time.time() - int(parts.get("t", 0))) > 300 or not hmac.compare_digest(expected, parts.get("v1", "")):
        abort(401)
    event = request.get_json()
    if event["id"] in seen_events:  # deliveries can repeat
        return "", 204
    seen_events.add(event["id"])

    row = contracts.get(event["data"].get("externalRef"))
    if row is not None:
        if event["type"] == "envelope.completed":
            pdf = requests.get(f"{PENLY}/v1/envelopes/{event['data']['envelopeId']}/documents/signed", headers=HEADERS, timeout=30)
            with open(f"{event['data']['externalRef']}.pdf", "wb") as f:
                f.write(pdf.content)
            row["status"] = "signed"
        elif event["type"] in ("envelope.declined", "envelope.voided", "envelope.expired"):
            row["status"] = event["type"].split(".")[1]
    return "", 204
