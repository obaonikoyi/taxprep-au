/**
 * What a page actually sent, as distinct from what it tried to send.
 *
 * Xoba Paycheck's promise is that payslips, statements and receipts never leave the
 * browser, and these smoke tests are what hold it to that. They used to check
 * the promise by looking at every request the page *started*, which was the
 * same thing as what it sent — until the app was put behind a proxy that
 * injects a third-party script into the page, and the app answered with a
 * Content-Security-Policy that makes the browser refuse it.
 *
 * A refused request never reached the network. Counting it as a leak would
 * fail the test on precisely the evidence that the page is safe. So record
 * what came back as well as what went out, assert on what was delivered, and
 * name anything that was refused rather than passing over it in silence: a
 * policy doing its job should be visible, and a new injection should never be
 * mistaken for an old one.
 */

/** Attach to a page before it navigates. */
export function watchRequests(page) {
  const attempted = [], delivered = new Set(), refused = new Map();
  page.on('request', request => attempted.push({ url: request.url(), method: request.method() }));
  page.on('response', response => delivered.add(response.url()));
  page.on('requestfailed', request => refused.set(request.url(), request.failure()?.errorText ?? 'no reason given'));
  return { attempted, delivered, refused };
}

/**
 * Assert the page sent nothing to a third party and nothing but GETs, and
 * return the third-party requests the browser refused, so the caller can
 * record them. Throws through the caller's own `assert` so failures read the
 * same as every other assertion in these scripts.
 *
 * `allowedPosts` names same-origin paths this journey is allowed to POST to,
 * and nothing else may be posted anywhere. It exists for the assisted payslip
 * reader, which sends the text of one payslip to this app's own server when the
 * person asks it to — the first thing in these journeys that deliberately
 * leaves the browser. A journey that passes none keeps the original rule, and a
 * journey that passes one still fails on any other POST, including to the same
 * path's origin by another route. Listing the path here is not enough on its
 * own: the caller is expected to assert that the post happened only after the
 * person opted in.
 */
export function assertStayedOnDevice(assert, log, base, allowedPosts = []) {
  const ours = url => url.startsWith(base.origin) || url.startsWith('blob:') || url.startsWith('data:');
  const unique = list => [...new Set(list)];
  const sent = log.attempted.filter(request => log.delivered.has(request.url));

  const reached = unique(sent.filter(request => !ours(request.url)).map(request => request.url));
  assert.deepEqual(reached, [], `The page reached a third party: ${reached.join(', ')}`);

  const permitted = new Set(allowedPosts.map(path => new URL(path, base.origin).href));
  const wrote = unique(sent
    .filter(request => request.method !== 'GET' && !(request.method === 'POST' && permitted.has(request.url)))
    .map(request => `${request.method} ${request.url}`));
  assert.deepEqual(wrote, [], `The page sent something other than a GET: ${wrote.join(', ')}`);

  return unique(log.attempted
    .filter(request => !ours(request.url) && !log.delivered.has(request.url))
    .map(request => `${request.url} (${log.refused.get(request.url) ?? 'never answered'})`));
}
