import assert from "node:assert/strict";
import {
  calibratedLoadMs,
  countImagesMissingAlt,
  hasMixedLoadedResources,
  medianLoadMs,
  shouldCompareDuplicateMetadata,
} from "../lib/crawler/engine";

const html = `
<html>
  <head>
    <link rel="stylesheet" href="https://example.com/app.css">
    <link href="http://cdn.example.com/old.css" rel="stylesheet">
  </head>
  <body>
    <a href="http://example.com/legacy-link">HTTP anchor is not loaded mixed content</a>
    <img src="/decorative.svg" alt="">
    <img src="/photo.jpg" alt="Harry Potter Studio Tour entrance">
    <img src="/missing.jpg">
  </body>
</html>`;

assert.equal(countImagesMissingAlt(html), 1);
assert.equal(
  countImagesMissingAlt('<img src="/decorative.svg" alt=""><img src="/has.jpg" alt="caption">'),
  0,
);
assert.equal(hasMixedLoadedResources('<a href="http://example.com/">legacy anchor</a>'), false);
assert.equal(hasMixedLoadedResources('<img src="http://cdn.example.com/photo.jpg" alt="photo">'), true);
assert.equal(hasMixedLoadedResources('<script src="http://cdn.example.com/app.js"></script>'), true);
assert.equal(hasMixedLoadedResources('<link rel="stylesheet" href="http://cdn.example.com/app.css">'), true);
assert.equal(hasMixedLoadedResources('<link href="http://cdn.example.com/app.css" rel="stylesheet">'), true);
assert.equal(medianLoadMs([6200, 1000, 1300]), 1300);
assert.equal(calibratedLoadMs(6200, [1000, 1300]), 1300);
assert.equal(calibratedLoadMs(6200, []), 6200);
assert.equal(shouldCompareDuplicateMetadata("https://peonchi.com/a", null), true);
assert.equal(shouldCompareDuplicateMetadata("https://peonchi.com/a", "https://peonchi.com/a"), true);
assert.equal(shouldCompareDuplicateMetadata("https://peonchi.com/legacy", "https://peonchi.com/canonical"), false);

console.log("crawler issue detection tests passed (13 assertions)");
