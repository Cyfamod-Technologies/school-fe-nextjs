import test from "node:test";
import assert from "node:assert/strict";
import { getBroadsheetError } from "./broadsheetResponse.ts";

test("detects Cloudflare challenges even with a successful status", () => {
  const response = new Response("", { headers: { "cf-mitigated": "challenge" } });
  assert.equal(getBroadsheetError(response, "challenge").status, 503);
});

test("recognizes challenge markup without the header", () => {
  const body = '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/test"></script>';
  const error = getBroadsheetError(new Response("", { status: 403 }), body);
  assert.equal(error.status, 503);
  assert.ok(!error.message.includes("<script"));
});

test("does not leak upstream HTML errors", () => {
  const response = new Response("", { status: 500, headers: { "content-type": "text/html" } });
  assert.ok(!getBroadsheetError(response, "<html>private debug details</html>").message.includes("private debug"));
});

test("preserves JSON validation errors and status", () => {
  const response = new Response("", { status: 422, headers: { "content-type": "application/json" } });
  assert.deepEqual(getBroadsheetError(response, '{"message":"Select a valid class."}'), {
    status: 422, message: "Select a valid class.",
  });
});

test("handles malformed and non-string JSON errors", () => {
  const response = new Response("", { status: 500, headers: { "content-type": "application/json" } });
  for (const body of ["{", '{"message":{"debug":"secret"}}', '{"message":"<html>secret</html>"}']) {
    assert.equal(getBroadsheetError(response, body).status, 500);
    assert.ok(!getBroadsheetError(response, body).message.includes("secret"));
  }
});

test("allows a successful broadsheet through unchanged", () => {
  assert.equal(getBroadsheetError(new Response(""), "<html>Broadsheet</html>"), null);
});
