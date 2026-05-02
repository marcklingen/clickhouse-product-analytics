# Third-Party Notices

This project contains implementation elements informed by PostHog open source
projects. Where behavior or schema choices stay close enough to be treated as
derived for distribution purposes, this file preserves conservative notices.

## PostHog JS

Portions of the browser SDK behavior, including autocapture filtering and
client API compatibility behavior, are informed by PostHog JS.

Source: <https://github.com/PostHog/posthog-js>  
License: Apache License 2.0 for the browser package; MIT for the React package

Copyright 2020 Posthog / Hiberly, Inc.  
Copyright 2015 Mixpanel, Inc.

The Apache License 2.0 text is reproduced in this repository's `LICENSE` file.

## PostHog React Package

Portions of the React provider and hook ergonomics are inspired by or derived
from the React package in PostHog JS.

Source: <https://github.com/PostHog/posthog-js/tree/main/packages/react>  
License: MIT

Copyright (c) 2020-2025 PostHog, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## PostHog Backend

Portions of the ClickHouse event/person schema and ingest semantics are
informed by the open source portions of PostHog Backend.

Source: <https://github.com/PostHog/posthog>  
License: MIT Expat for content outside `ee/`

Copyright (c) 2020-2025 PostHog Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Excluded Material

No material from the PostHog Backend `ee/` directory is intentionally included.
That directory is governed by the PostHog Enterprise license and must not be
copied or derived from without an appropriate license.
