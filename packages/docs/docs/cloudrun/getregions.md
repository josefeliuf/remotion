---
image: /generated/articles-docs-cloudrun-getregions.png
id: getregions
title: getRegions()
crumb: "Cloud Run API"
---

<ExperimentalBadge>
<p>Cloud Run is in <a href="/docs/cloudrun-alpha">Alpha</a>, which means APIs may change in any version and documentation is not yet finished. See the <a href="https://remotion.dev/changelog">changelog to stay up to date with breaking changes</a>.</p>
</ExperimentalBadge>

Gets an array of all supported GCP regions of this release of Remotion Cloud Run.

## Example

```tsx twoslash
// @module: esnext
// @target: es2017
import { getRegions } from "@remotion/cloudrun";

// ---cut---

const regions = getRegions();
// ["asia-east1", "us-east1"]
```

## Return value

An array of supported regions by this release of Remotion Cloud Run.

## See also

- [Source code for this function](https://github.com/remotion-dev/remotion/blob/main/packages/cloudrun/src/api/get-regions.ts)
- [Region selection](/docs/cloudrun/region-selection)
