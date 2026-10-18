<?php
// PenlyDoc webhook: check the HMAC signature on the raw body, ignore repeats, then update your record.
$raw = file_get_contents('php://input');
$parts = [];
foreach (explode(',', $_SERVER['HTTP_PENLY_SIGNATURE'] ?? '') as $p) {
    [$k, $v] = array_pad(explode('=', $p, 2), 2, '');
    $parts[$k] = $v;
}
$expected = hash_hmac('sha256', ($parts['t'] ?? '') . '.' . $raw, getenv('PENLY_WEBHOOK_SECRET'));
if (abs(time() - (int) ($parts['t'] ?? 0)) > 300 || !hash_equals($expected, $parts['v1'] ?? '')) {
    http_response_code(401);
    exit;
}

$event = json_decode($raw, true);
if (already_processed($event['id'])) { http_response_code(204); exit; }   // your code: deliveries can repeat

switch ($event['type']) {
    case 'recipient.completed':
        mark_signer($event['data']['externalRef'], $event['data']['recipient']['email'], 'signed');
        break;
    case 'envelope.completed':
        // fetch GET /v1/envelopes/{envelopeId}/documents/signed in a background job and keep the PDF
        queue_signed_pdf_download($event['data']['envelopeId'], $event['data']['externalRef']);
        break;
    case 'envelope.declined': case 'envelope.voided': case 'envelope.expired':
        mark_contract($event['data']['externalRef'], explode('.', $event['type'])[1]);
        break;
}
http_response_code(204);
