// Tests for parseGeminiResponse — the Gemini JSON response parser
// Run: node test-parse-gemini.js

const { parseGeminiResponse } = require('./server');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\nparseGeminiResponse tests:\n');

// --- Clean JSON ---

test('parses clean JSON object', () => {
  const result = parseGeminiResponse('{"tripType":"round_trip","totalPrice":299}');
  assert(result.success, 'should succeed');
  assertEqual(result.data.tripType, 'round_trip');
  assertEqual(result.data.totalPrice, 299);
});

// --- Markdown code fences ---

test('parses JSON wrapped in ```json fences', () => {
  const result = parseGeminiResponse('```json\n{"tripType":"one_way","totalPrice":150}\n```');
  assert(result.success, 'should succeed');
  assertEqual(result.data.tripType, 'one_way');
});

test('parses JSON wrapped in ``` fences (no json tag)', () => {
  const result = parseGeminiResponse('```\n{"airline":"AZ"}\n```');
  assert(result.success, 'should succeed');
  assertEqual(result.data.airline, 'AZ');
});

// --- Text before/after JSON ---

test('extracts JSON with text before it', () => {
  const result = parseGeminiResponse('Here is the extracted data:\n{"tripType":"round_trip"}');
  assert(result.success, 'should succeed');
  assertEqual(result.data.tripType, 'round_trip');
});

test('extracts JSON with text after it', () => {
  const result = parseGeminiResponse('{"tripType":"round_trip"}\n\nNote: some fields were missing.');
  assert(result.success, 'should succeed');
  assertEqual(result.data.tripType, 'round_trip');
});

test('extracts JSON with text before and after', () => {
  const result = parseGeminiResponse('The result:\n```json\n{"totalPrice":450}\n```\nAll fields extracted.');
  assert(result.success, 'should succeed');
  assertEqual(result.data.totalPrice, 450);
});

// --- Trailing commas ---

test('handles trailing comma before }', () => {
  const result = parseGeminiResponse('{"airline":"U2","flightNumber":"U2 2987",}');
  assert(result.success, 'should succeed');
  assertEqual(result.data.airline, 'U2');
});

test('handles trailing comma before ]', () => {
  const result = parseGeminiResponse('{"segments":["a","b",]}');
  assert(result.success, 'should succeed');
  assertEqual(result.data.segments.length, 2);
});

test('handles nested trailing commas', () => {
  const input = '{"outbound":[{"airline":"AZ","flight":"AZ2021",},],"totalPrice":132,}';
  const result = parseGeminiResponse(input);
  assert(result.success, 'should succeed');
  assertEqual(result.data.outbound[0].airline, 'AZ');
});

// --- Real Gemini responses (Skyscanner) ---

test('parses real Skyscanner extraction response', () => {
  const geminiText = `\`\`\`json
{
  "tripType": "round_trip",
  "cabinClass": "economy",
  "passengers": {"adults": 1, "children": 0, "infants": 0},
  "outboundSegments": [
    {
      "airline": "AZ",
      "flightNumber": "AZ2021",
      "departure": "LIN",
      "arrival": "FCO",
      "departureTime": "08:00",
      "arrivalTime": "09:10",
      "date": "2026-04-25",
      "flightDuration": "01:10"
    }
  ],
  "returnSegments": [
    {
      "airline": "AZ",
      "flightNumber": "AZ2058",
      "departure": "FCO",
      "arrival": "LIN",
      "departureTime": "21:00",
      "arrivalTime": "22:10",
      "date": "2026-04-25",
      "flightDuration": "01:10"
    }
  ],
  "totalPrice": 132,
  "currency": "CHF",
  "isFlightBooking": true,
  "allPresent": true,
  "missingItems": [],
  "routeType": "round_trip"
}
\`\`\``;
  const result = parseGeminiResponse(geminiText);
  assert(result.success, 'should succeed');
  assertEqual(result.data.outboundSegments[0].departure, 'LIN');
  assertEqual(result.data.returnSegments[0].departure, 'FCO');
  assertEqual(result.data.totalPrice, 132);
  assertEqual(result.data.currency, 'CHF');
  assertEqual(result.data.allPresent, true);
});

// --- Real Gemini response (Google Flights with connections) ---

test('parses Google Flights multi-segment response', () => {
  const geminiText = `{
  "tripType": "round_trip",
  "cabinClass": "economy",
  "passengers": {"adults": 1, "children": 0, "infants": 0},
  "outboundSegments": [
    {
      "airline": "AT",
      "flightNumber": "AT937",
      "departure": "ZRH",
      "arrival": "CMN",
      "departureTime": "13:50",
      "arrivalTime": "16:45",
      "date": "2026-04-10",
      "flightDuration": "03:55"
    },
    {
      "airline": "AT",
      "flightNumber": "AT440",
      "departure": "CMN",
      "arrival": "FEZ",
      "departureTime": "23:00",
      "arrivalTime": "00:15",
      "date": "2026-04-10",
      "flightDuration": "01:15"
    }
  ],
  "returnSegments": [
    {
      "airline": "AT",
      "flightNumber": "AT441",
      "departure": "FEZ",
      "arrival": "CMN",
      "departureTime": "05:30",
      "arrivalTime": "06:45",
      "date": "2026-04-17",
      "flightDuration": "01:15"
    },
    {
      "airline": "AT",
      "flightNumber": "AT938",
      "departure": "CMN",
      "arrival": "ZRH",
      "departureTime": "09:00",
      "arrivalTime": "12:50",
      "date": "2026-04-17",
      "flightDuration": "02:50"
    }
  ],
  "totalPrice": 585,
  "currency": "CHF",
  "isFlightBooking": true,
  "allPresent": true,
  "missingItems": [],
  "routeType": "round_trip"
}`;
  const result = parseGeminiResponse(geminiText);
  assert(result.success, 'should succeed');
  assertEqual(result.data.outboundSegments.length, 2);
  assertEqual(result.data.returnSegments.length, 2);
  assertEqual(result.data.outboundSegments[0].departure, 'ZRH');
  assertEqual(result.data.returnSegments[1].arrival, 'ZRH');
  assertEqual(result.data.totalPrice, 585);
});

// --- Truncated JSON (the actual bug we hit) ---

test('fails gracefully on truncated JSON (no closing brace)', () => {
  const truncated = '{"tripType":"round_trip","outboundSegments":[{"airline":"AZ"';
  const result = parseGeminiResponse(truncated);
  assert(!result.success, 'should fail');
  assert(result.error, 'should have error message');
});

test('fails gracefully on truncated JSON (partial closing)', () => {
  const truncated = '{"tripType":"round_trip","outboundSegments":[{"airline":"AZ"}';
  const result = parseGeminiResponse(truncated);
  assert(!result.success, 'should fail');
  assert(result.raw, 'should include raw text');
});

// --- Null/empty values ---

test('parses response with null values', () => {
  const result = parseGeminiResponse('{"airline":null,"flightNumber":null,"totalPrice":299}');
  assert(result.success, 'should succeed');
  assertEqual(result.data.airline, null);
  assertEqual(result.data.totalPrice, 299);
});

// --- Edge cases ---

test('fails on empty string', () => {
  const result = parseGeminiResponse('');
  assert(!result.success, 'should fail');
});

test('fails on null', () => {
  const result = parseGeminiResponse(null);
  assert(!result.success, 'should fail');
});

test('fails on undefined', () => {
  const result = parseGeminiResponse(undefined);
  assert(!result.success, 'should fail');
});

test('fails on text with no JSON', () => {
  const result = parseGeminiResponse('I could not extract any flight details from the provided text.');
  assert(!result.success, 'should fail');
  assert(result.error.includes('No JSON'), 'should say no JSON found');
});

test('handles response with only explanation, no JSON', () => {
  const result = parseGeminiResponse('The text does not appear to contain flight booking information. It seems to be UI navigation elements.');
  assert(!result.success, 'should fail');
});

// --- Single-quoted strings (some Gemini models do this) ---

test('handles single-quoted JSON strings', () => {
  const result = parseGeminiResponse("{'tripType':'round_trip','totalPrice':299}");
  assert(result.success, 'should succeed');
  assertEqual(result.data.tripType, 'round_trip');
});

// --- Nested markdown with extra whitespace ---

test('handles extra whitespace and newlines in fences', () => {
  const result = parseGeminiResponse('\n\n```json\n\n  {"totalPrice": 100}  \n\n```\n\n');
  assert(result.success, 'should succeed');
  assertEqual(result.data.totalPrice, 100);
});

// --- Summary ---

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
