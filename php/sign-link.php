<?php
// POST /sign-link.php?contract=lease-2291 → {"url": "...", "expiresAt": "..."}
// Look the contract up in your database and check that the logged-in user is its signer before asking PenlyDoc.
$penly = getenv('PENLY_URL') ?: 'https://penlydoc.com';
$row = find_signer_for_current_user($_GET['contract'] ?? '');   // your code: returns envelope and recipient ids, or null
if (!$row) { http_response_code(404); exit; }

$ch = curl_init("$penly/v1/envelopes/{$row['envelope']}/recipients/{$row['recipient']}/signing-url");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => '{}',
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('PENLY_API_KEY'), 'Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

header('Content-Type: application/json');
header('Cache-Control: no-store');
if ($status !== 200) { http_response_code(502); echo $body; exit; }
$link = json_decode($body, true);
echo json_encode(['url' => $link['url'], 'expiresAt' => $link['expiresAt']]);
